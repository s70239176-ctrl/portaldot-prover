#![cfg_attr(not(feature = "std"), no_std)]

use ink_lang as ink;

#[ink::contract]
mod portaldot_prover {
    use ink_prelude::string::String;
    use ink_prelude::vec::Vec;
    use ink_storage::traits::SpreadAllocate;
    use ink_storage::Mapping;

    const MIN_STAKE: Balance = 100_000_000_000_000;
    const MIN_PRICE: Balance = 10_000_000_000_000;

    #[derive(scale::Decode, scale::Encode, Clone)]
    #[cfg_attr(
        feature = "std",
        derive(scale_info::TypeInfo, ink_storage::traits::StorageLayout)
    )]
    pub struct ModelInfo {
        pub id: u32,
        pub creator: AccountId,
        pub model_hash: Hash,
        pub metadata: String,
        pub price: Balance,
        pub stake: Balance,
        pub total_purchases: u32,
        pub total_verifications: u32,
        pub is_active: bool,
        pub registered_at: BlockNumber,
    }

    #[derive(scale::Decode, scale::Encode, Clone, Debug, PartialEq)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub struct VerificationProof {
        pub model_id: u32,
        pub verifier: AccountId,
        pub input_hash: Hash,
        pub proof_hash: Hash,
        pub verified_at: BlockNumber,
    }

    #[derive(scale::Decode, scale::Encode, Debug, PartialEq)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub enum Error {
        StakeTooLow,
        PriceTooLow,
        ModelNotFound,
        ModelNotActive,
        InsufficientPayment,
        AccessNotGranted,
        NotCreator,
        MetadataTooLong,
        TransferFailed,
        Overflow,
    }

    #[ink(event)]
    pub struct ModelRegistered {
        #[ink(topic)]
        model_id: u32,
        #[ink(topic)]
        creator: AccountId,
        price: Balance,
        stake: Balance,
    }

    #[ink(event)]
    pub struct AccessPurchased {
        #[ink(topic)]
        model_id: u32,
        #[ink(topic)]
        buyer: AccountId,
        amount_paid: Balance,
    }

    #[ink(event)]
    pub struct InferenceVerified {
        #[ink(topic)]
        model_id: u32,
        #[ink(topic)]
        verifier: AccountId,
        proof_hash: Hash,
    }

    #[ink(event)]
    pub struct EarningsWithdrawn {
        #[ink(topic)]
        creator: AccountId,
        amount: Balance,
    }

    #[ink(storage)]
    #[derive(SpreadAllocate)]
    pub struct PortaldotProver {
        next_model_id: u32,
        models: Mapping<u32, ModelInfo>,
        access_rights: Mapping<(AccountId, u32), bool>,
        creator_earnings: Mapping<AccountId, Balance>,
        owner: AccountId,
        total_models: u32,
        total_volume: Balance,
    }

    impl PortaldotProver {
        #[ink(constructor)]
        pub fn new() -> Self {
            ink_lang::utils::initialize_contract(|c: &mut Self| {
                c.next_model_id = 1;
                c.owner = Self::env().caller();
                c.total_models = 0;
                c.total_volume = 0;
            })
        }

        #[ink(message, payable)]
        pub fn register_model(
            &mut self,
            model_hash: Hash,
            metadata: String,
            price: Balance,
        ) -> Result<u32, Error> {
            let caller = self.env().caller();
            let stake  = self.env().transferred_value();
            if stake < MIN_STAKE     { return Err(Error::StakeTooLow);    }
            if price < MIN_PRICE     { return Err(Error::PriceTooLow);    }
            if metadata.len() > 1024 { return Err(Error::MetadataTooLong);}
            let model_id = self.next_model_id;
            self.next_model_id = self.next_model_id
                .checked_add(1).ok_or(Error::Overflow)?;
            let model = ModelInfo {
                id: model_id, creator: caller, model_hash,
                metadata, price, stake,
                total_purchases: 0, total_verifications: 0,
                is_active: true,
                registered_at: self.env().block_number(),
            };
            self.models.insert(model_id, &model);
            self.total_models = self.total_models
                .checked_add(1).ok_or(Error::Overflow)?;
            self.env().emit_event(ModelRegistered {
                model_id, creator: caller, price, stake,
            });
            Ok(model_id)
        }

        #[ink(message, payable)]
        pub fn purchase_access(&mut self, model_id: u32) -> Result<(), Error> {
            let caller  = self.env().caller();
            let payment = self.env().transferred_value();
            let mut model = self.models.get(model_id)
                .ok_or(Error::ModelNotFound)?;
            if !model.is_active      { return Err(Error::ModelNotActive);      }
            if payment < model.price { return Err(Error::InsufficientPayment); }
            self.access_rights.insert((caller, model_id), &true);
            let e = self.creator_earnings.get(model.creator).unwrap_or(0);
            self.creator_earnings.insert(model.creator,
                &e.checked_add(payment).ok_or(Error::Overflow)?);
            model.total_purchases = model.total_purchases
                .checked_add(1).ok_or(Error::Overflow)?;
            self.models.insert(model_id, &model);
            self.total_volume = self.total_volume
                .checked_add(payment).ok_or(Error::Overflow)?;
            self.env().emit_event(AccessPurchased {
                model_id, buyer: caller, amount_paid: payment,
            });
            Ok(())
        }

        #[ink(message)]
        pub fn verify_inference(
            &mut self,
            model_id: u32,
            input_hash: Hash,
        ) -> Result<VerificationProof, Error> {
            let caller = self.env().caller();
            if !self.access_rights.get((caller, model_id)).unwrap_or(false) {
                return Err(Error::AccessNotGranted);
            }
            let mut model = self.models.get(model_id)
                .ok_or(Error::ModelNotFound)?;
            if !model.is_active { return Err(Error::ModelNotActive); }
            let block_number = self.env().block_number();
            let mut preimage = Vec::new();
            preimage.extend_from_slice(model.model_hash.as_ref());
            preimage.extend_from_slice(input_hash.as_ref());
            preimage.extend_from_slice(caller.as_ref());
            preimage.extend_from_slice(&block_number.to_le_bytes());
            let mut out = [0u8; 32];
            ink_env::hash_bytes::<ink_env::hash::Blake2x256>(&preimage, &mut out);
            let proof_hash = Hash::from(out);
            model.total_verifications = model.total_verifications
                .checked_add(1).ok_or(Error::Overflow)?;
            self.models.insert(model_id, &model);
            self.env().emit_event(InferenceVerified {
                model_id, verifier: caller, proof_hash,
            });
            Ok(VerificationProof {
                model_id, verifier: caller,
                input_hash, proof_hash,
                verified_at: block_number,
            })
        }

        #[ink(message)]
        pub fn withdraw_earnings(&mut self) -> Result<Balance, Error> {
            let caller = self.env().caller();
            let e = self.creator_earnings.get(caller).unwrap_or(0);
            if e == 0 { return Ok(0); }
            self.creator_earnings.insert(caller, &0);
            self.env().transfer(caller, e)
                .map_err(|_| Error::TransferFailed)?;
            self.env().emit_event(EarningsWithdrawn { creator: caller, amount: e });
            Ok(e)
        }

        #[ink(message)]
        pub fn deactivate_model(&mut self, model_id: u32) -> Result<(), Error> {
            let caller = self.env().caller();
            let mut model = self.models.get(model_id).ok_or(Error::ModelNotFound)?;
            if model.creator != caller { return Err(Error::NotCreator); }
            let stake = model.stake;
            model.is_active = false;
            model.stake = 0;
            self.models.insert(model_id, &model);
            if stake > 0 {
                self.env().transfer(caller, stake)
                    .map_err(|_| Error::TransferFailed)?;
            }
            Ok(())
        }

        #[ink(message)]
        pub fn get_model(&self, model_id: u32) -> Option<ModelInfo> {
            self.models.get(model_id)
        }

        #[ink(message)]
        pub fn has_access(&self, account: AccountId, model_id: u32) -> bool {
            self.access_rights.get((account, model_id)).unwrap_or(false)
        }

        #[ink(message)]
        pub fn get_earnings(&self, creator: AccountId) -> Balance {
            self.creator_earnings.get(creator).unwrap_or(0)
        }

        #[ink(message)]
        pub fn get_stats(&self) -> (u32, Balance) {
            (self.total_models, self.total_volume)
        }

        #[ink(message)]
        pub fn list_model_ids(&self, offset: u32, limit: u32) -> Vec<u32> {
            let start = offset.saturating_add(1);
            let end   = start.saturating_add(limit).min(self.next_model_id);
            (start..end).collect()
        }
    }
}
