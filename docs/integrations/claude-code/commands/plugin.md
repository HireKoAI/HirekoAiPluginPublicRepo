---
description: Install or update this plugin from a private S3 bucket (SSO + SigV4, all steps internal)
---

Install the plugin from the S3 URI the user provides ($ARGUMENTS). Do every step yourself in the terminal; the user should not copy-paste AWS commands.

Resolve the CLI name as the zip stem with `-x.y.z.zip` stripped (or `package.json` `"bin"` key after unzip). Call that `<cli>` below.

1. If `<cli>` is already on PATH, just run:
   `<cli> plugin install $ARGUMENTS`
   and stop there.

2. Otherwise bootstrap internally, in order, stopping and reporting on any failure. The profile name is the sanitized current directory name `<dirname>`; the AWS account is `<account-id>` (ask the user for their Hireko AWS account id; override only if the user says so):
   a. Self-configure the profile: `aws configure set profile.<dirname>.sso_start_url <sso-start-url>`, `.sso_region us-east-1`, `.sso_account_id <account-id>`, `.region us-west-2` (ask the user for their AWS Identity Center start URL and account id).
   b. If the profile has no `sso_role_name`: `aws sso login --profile <dirname>` (opens the browser; wait), then read the accessToken for that start URL from `~/.aws/sso/cache/*.json`, run `aws sso list-account-roles --account-id <account-id> --access-token <token> --region us-east-1` with `AWS_CONFIG_FILE`/`AWS_SHARED_CREDENTIALS_FILE` pointed at an empty temp file, pick the single role (or ask the user when several), and `aws configure set profile.<dirname>.sso_role_name <role>`.
   c. Ensure a live session: `aws sts get-caller-identity --profile <dirname>`; on failure, `aws sso login --profile <dirname>`. Then assert the Account from get-caller-identity equals `<account-id>`.
   d. `aws s3 cp $ARGUMENTS /tmp/$(basename "$ARGUMENTS") --profile <dirname>` and the matching `.sha256` sidecar; verify with `shasum -a 256 -c`.
   e. Stem=`basename "$ARGUMENTS" | sed -E 's/-[0-9]+\.[0-9]+\.[0-9]+\.zip$//'`. `unzip -q /tmp/$(basename "$ARGUMENTS") -d ~/.hireko/plugins/$Stem`.
   f. `npm install -g ~/.hireko/plugins/$Stem`.
   g. Restart the harness; do not register MCP by hand.

3. Finish by telling the user: run `<cli> login` once in a terminal (Cognito; the password never enters this conversation), then type `/<cli>`.

Never echo access keys, secrets, session tokens, or passwords. If any credential value would appear in output you show, mask it.
