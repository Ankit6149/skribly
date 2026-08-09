create index device_trials_first_user_id_idx
  on skribly_private.device_trials (first_user_id)
  where first_user_id is not null;

create index device_trials_last_user_id_idx
  on skribly_private.device_trials (last_user_id)
  where last_user_id is not null;
