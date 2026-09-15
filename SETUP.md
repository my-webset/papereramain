# Paperera Workspace Setup

### 1. Database Setup (Supabase SQL Editor)
1. Open your [Supabase Dashboard](https://supabase.com/dashboard).
2. Navigate to the **SQL Editor**.
3. Copy the entire contents of [`schema.sql`](schema.sql) and click **Run**.
4. This will create all tables, `pgcrypto` password encryption, default settings, and secure RPC stored procedures.

### 2. Configuration
1. Ensure your `config.js` has your Supabase URL and anon key:
```javascript
window.PAPERERA_CONFIG = {
  supabaseUrl: 'https://your-project.supabase.co',
  supabaseAnonKey: 'sb_publishable_your_anon_key'
};
```

### 3. Admin Access
- Default Admin ID: `admin`
- Default Admin Password: `admin123`
- You can change your admin password anytime by clicking **Change Admin Password** in the top bar of `admin.html`.

### 4. How the System Works
1. **Homepage Pricing & AI Trial**:
   - Admin can update Domain prices, AI paper bundle prices, monthly site upkeep rates, and AI trial charges directly in `admin.html`.
   - The public homepage (`index.html`) updates automatically in real-time.
2. **Worker Management**:
   - Admin creates workers with custom or generated Worker IDs (e.g., `WKR-101`) and sets their initial passwords.
   - Admin can reset or change any worker's password at any time.
3. **Daily & Weekly Targets**:
   - Admin can set and dispatch both **Today's Target** and **Weekly Target** with custom notes to any worker.
4. **Lead Submission & Commission Payouts**:
   - Workers log in at `worker.html` with their Worker ID and Password.
   - Workers submit school leads (school name, contact person, phone, service type, notes).
   - Leads appear on the Admin desk tagged with the submitting worker's name and ID.
   - Admin marks leads as **Paid** or **Unpaid**.
   - When marked **Paid**, the worker's earnings update instantly based on the fixed commission rate set by Admin. If Unpaid, worker earnings remain ₹0.
