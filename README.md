# BOARD backups

## A. Supabase nightly backup (2 minutes)

1. Supabase → your project → **SQL Editor** → **New query**.
2. Paste all of `supabase-nightly-backup.sql` → **Run**.
3. The last line should say something like `71 proposals backed up at 2026-11-04 …`.

It now runs every night at 02:00 UTC and keeps 30 days.

**To see backups:** Table Editor → `proposals_backup`.
**To restore one proposal** (replace the id and date):

```sql
update proposals p set data = b.data
from proposals_backup b
where b.id = 'cisco-f9slyv' and p.id = b.id
  and b.backed_up_at = (select max(backed_up_at) from proposals_backup where id = 'cisco-f9slyv' and backed_up_at < '2026-11-05');
```

## B. GitHub off-site backup (10 minutes)

1. github.com → **+** → **New repository** → name it `board-backups` → choose **Private** → **Create repository**.
2. On the new repo page click **uploading an existing file**. Drag in `backup.mjs` and `README.md` → **Commit changes**.
3. Add the workflow: **Add file → Create new file**. In the name box type exactly
   `.github/workflows/backup.yml`
   then paste the contents of `backup.yml` → **Commit changes**.
   (Typing the name is easier than uploading — GitHub hides folders starting with a dot.)
4. **Settings → Secrets and variables → Actions → New repository secret**, add three:
   - `SUPABASE_URL` = `https://wqzbywvpwfwsvrvxrmnh.supabase.co`
   - `SUPABASE_ANON_KEY` = the anon key (same one the site uses — Supabase → Project Settings → API)
   - `SITE_URL` = `https://board-sponsorship-prospectus.netlify.app`
5. **Settings → Actions → General → Workflow permissions** → **Read and write permissions** → Save.
6. **Actions** tab → **Nightly BOARD backup** → **Run workflow**. After a minute it goes green and the repo fills with:
   - `latest/` — today's proposals and catalogue
   - `snapshots/YYYY-MM-DD/` — one folder per day, kept forever
   - `files/` — every logo, video and custom photo (each downloaded once)
   - `LAST_BACKUP.txt` — summary of the last run

From then on it runs every night at 03:00 UTC. If a run fails, GitHub emails you.

**If the site moves** (e.g. to boardsummits.com), update the `SITE_URL` secret.
# board-backups
