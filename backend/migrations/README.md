# Database migrations

Run migrations once against an existing ShortLearn database before deploying
the matching API version. Fresh databases already receive these columns from
the repository root `init.sql`.

For MySQL CLI:

```powershell
Get-Content .\backend\migrations\001_add_vocabulary_learning_metadata.sql -Raw |
  mysql -h localhost -u root -p shortlearn_db
```

Migration `001` is idempotent and keeps the FSRS `state` and `srs_stage`
columns unchanged.

Migration `003_auth_foundation.sql` upgrades an existing database with:

- public user IDs, normalized email, verification/lock/status metadata;
- external login identities;
- device-scoped sessions;
- hashed, rotating refresh-token history;
- hashed, expiring, single-use OTP challenges with attempt limits.

Run it with:

```powershell
Get-Content .\backend\migrations\003_auth_foundation.sql -Raw |
  mysql -h localhost -u root -p shortlearn_db
```

It is safe to run repeatedly on MySQL 8.x. Back up production data first. The
migration deliberately does not store raw refresh tokens or OTP values.
