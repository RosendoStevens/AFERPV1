# PrintPress ERP – Online (shared database, staff logins, roles)

Everyone (PC, phone, tablet) uses the same data, live. Each staff member has their own login and a role.
**Internet is required** (no offline mode). Your older offline app is unchanged and separate.

## 1. Create the free Supabase project (5 min)
1. Go to supabase.com → sign up → **New project**. Pick a name, a database password (save it), and the region nearest you.
2. Wait until the project is ready.

## 2. Turn off email confirmation (recommended for a small shop)
Authentication → Sign In / Providers → Email → switch **Confirm email OFF** → Save.
(If left ON, every new staff member must click an email link first, and the free plan sends only a few emails per hour.)

## 3. Install the database
1. Open `supabase/schema.sql` in a text editor.
2. Find the line marked `-- <<< EDIT: your email` and replace `CHANGE-ME@example.com` with **your own email**. The first account created with that email becomes **Administrator**.
3. Supabase → **SQL Editor** → New query → paste the whole file → **Run**. It can safely be run again.

## 4. Put the app online (HTTPS is required)
Upload the whole folder to any HTTPS static host: Netlify Drop (drag & drop the folder), Cloudflare Pages, GitHub Pages, or your own hosting. Open the link on PC and phone; on the phone use "Add to Home screen".

## 5. Connect the app
Supabase → Project Settings → API. Copy **Project URL** and the **anon public** key.
Either paste them into `config.js` before uploading (best: nobody has to type them), or enter them on the app's first screen.
**Never use the `service_role` key** (the app refuses it).

## 6. First sign-in
Open the app → **Create account** using the owner email from step 3 → you are Administrator. Open **Settings** to run the **connection check**; every line should be green.

## 7. Add staff
Send staff the app link. They press **Create account**; they then appear in **Staff & Roles** as "Choose a role…". Pick a role. You can switch accounts off any time.

| Role | Can do |
|---|---|
| Administrator | Everything, incl. staff, restore, erase |
| Manager | Everything except changing settings; can delete and download backups |
| Sales / Accounts | Customers, orders/quotes, invoices, payments, expenses (no deleting); views the rest |
| Designer | Artwork & approvals; views customers, orders, jobs |
| Production / Operator | Job board, inventory & stock; views customers, orders, artwork |

**Changing what a role can do:** Administrator and Manager can use **Settings → Role permissions** to set each role to **No access, View, Edit or Full** for every kind of information (customers, orders, job cards, inventory, invoices, payroll and so on). Changes save immediately and reach people within a minute. The Administrator role cannot be changed, and only the Administrator can change the Manager role. If you installed earlier, run `supabase/update-3.sql` once. Re-running `schema.sql` no longer resets permissions you changed.

Designers/operators can also move an order's status (e.g. Design → In Production) without editing the order. Rules live in the `role_perms` table and are enforced by the database, not just hidden buttons.

## Production steps
Settings → **Production steps** (Administrator): add, rename, reorder (↑ ↓) and delete the steps job cards move through. The first step is planning (no stock used); the last means finished. Job cards are renumbered automatically; deleting a step moves its jobs to the previous one.

## Job cards, attendance, payroll, suppliers (new)
- **Job cards** start in the **Design** step and show the full order (items, sizes, quantities, **no prices**), the design brief, client reference files (up to 10 per job, 10 MB each), the artwork added for the order, and the team: designer, machine, machine operator, finishing operator, quality check. Use **Add order to production** on the Production page to send an order straight in.
- **Attendance** (Attendance page): Staff list with hourly rate, overtime rate, allowance and EPF membership; daily In/Out sheet with a **Now** button; month summary; **Import** a punch-log CSV from a biometric device (earliest punch = In, latest = Out; matched by Biometric ID or staff no.). Each record remembers its source, so a direct device connection can be added later.
- **Payroll** (Payroll page): hours x rate, overtime, allowances, bonus, then EPF (rate set in Settings), salary advance and other deductions. **Save & mark paid** locks the month and adds the net salary to **Expenses**; Reopen removes it. Payslip and summary print, and CSV export.
- Administrator, Manager and Sales/Accounts can use Attendance and Payroll. Other roles cannot see them (enforced by the database).
- **Suppliers** and **Inventory** are stand-alone: job cards no longer use up stock. Record stock movements in Inventory and purchases in Expenses.

### Updating an existing installation
If you already ran `schema.sql` once, run **`supabase/update-2.sql`** (if you have not yet) and **`supabase/update-3.sql`** once each in Supabase > SQL Editor (it keeps all data), then upload the new app files. New installs only need `schema.sql`. When the administrator first opens the app, the production line is upgraded to start with a **Design** step (job cards are renumbered automatically).

## Item list, calculator, signature, team pickers, notifications (update 4)
- **Item list:** Settings > Item list. Save ready-made items (name, size, rate). In a new order/quotation/invoice pick **+ Add from item list**; typing a saved item name also fills size and rate.
- **Calculator:** the calculator button beside each Rate box. Type e.g. `6*3*45`, then **Use as rate**.
- **Authorized signature:** Settings > Authorized signature. Upload an image; it prints above the "Authorized signature" line on invoices, orders, quotations and other documents. Remove it any time.
- **Job card team:** Designer, machine operator, finisher and QC are picked from your staff list (Attendance staff), not typed.
- **Notifications (bell, top bar):** a person is notified when a job is assigned to them, when a job reaches their production step, and designers are notified of new job cards and client revision requests. For this the staff record must be linked to the person's login: turn on **Attendance** for them in Staff & Roles (links automatically), or choose **App login** in the staff form. If a new job has no designer, all designers are notified. Notifications work while the app is open (bell, toast and an optional browser pop-up); there is no push when the app is closed.
- **Staff & Roles > Attendance switch** (between Status and Joined) adds the person to Attendance or removes them (history is kept).

**Upgrading:** run `supabase/update-4.sql` once in Supabase > SQL Editor (safe to re-run), then upload the changed files, including the NEW file `js/extras.js`.

## If a second device asks for the Project URL and key
1. Put the two values in `config.js` and upload that file to the same place as `index.html` (the one on your host, not only on your computer).
2. Reload the page (on a phone: close the tab and reopen). The app always reads the newest `config.js`.
3. If the screen still asks, it now says why: "config.js was not found", "config.js is empty", or "config.js has a typing mistake" (usually a missing quote or comma, or curly quotes pasted from a document).

## Moving from the offline version
Old app: Settings → Download backup. New app (as Administrator): Settings → **Restore from file**. Artwork files move into online storage automatically.

## How sharing works
- Changes from others appear within ~5 seconds.
- If two people edit the same record at once, the second is told and sees the latest version.
- Invoice/order numbers and stock changes are handled by the database, so two people never get the same number or overwrite each other's stock.

## Things to know (free plan)
- Free projects **pause after about a week with no use**; open the Supabase dashboard to resume.
- **No automatic backups** on the free plan. Download a backup regularly (the app reminds you). The backup JSON contains the data, **not** the original artwork files (those stay in Supabase Storage).
- Artwork upload limit is 3 MB per file.
- Forgot password: "Forgot password?" on the sign-in screen (uses Supabase's emails).

## Testing note
This build was tested against a real PostgreSQL database with the real `schema.sql` (security rules, roles, numbering, stock) and a browser, **but through a local stand-in for Supabase's web API, not a real Supabase project** (the test environment couldn't reach Supabase). Use the connection check in step 6; if any line is red, it says what to fix.
