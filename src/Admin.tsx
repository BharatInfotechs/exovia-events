
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from './lib/supabase';
import {
  addCRM,
  csv,
  download,
  loadCRM,
  makeId,
  removeCRM,
  updateCRM,
  type CRMState,
  type Lead,
  type Vendor,
  type Customer,
} from './crm';

const tabs = [
  ['overview', 'Overview'],
  ['leads', 'Leads'],
  ['vendors', 'Vendors'],
  ['customers', 'Customers'],
  ['events', 'Events'],
  ['eventBookings', 'Event Bookings'],
  ['payments', 'Payments'],
  ['tasks', 'Tasks'],
] as const;

type Tab = typeof tabs[number][0];

type AdminProfile = {
  id: string;
  full_name: string;
  email: string | null;
  role:
    | 'super_admin'
    | 'admin_client'
    | 'sales_executive'
    | 'event_manager'
    | 'finance';
  is_active: boolean;
};

const UP_EVENT_LOCATIONS = [
  'Lucknow, Uttar Pradesh',
  'Kanpur, Uttar Pradesh',
  'Noida, Uttar Pradesh',
  'Varanasi, Uttar Pradesh',
];

function Admin() {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);

  const [tab, setTab] = useState<Tab>('overview');
  const [data, setData] = useState<CRMState>(loadCRM());
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadsError, setLeadsError] = useState('');
  const [registrationsLoading, setRegistrationsLoading] = useState(false);
  const [registrationsError, setRegistrationsError] = useState('');

  const refresh = () => setData((current) => ({ ...loadCRM(), leads: current.leads, vendors: current.vendors, customers: current.customers }));

  // Leads are now stored in Supabase. The other CRM modules remain local for now.
  const loadSupabaseLeads = useCallback(async () => {
    setLeadsLoading(true);
    setLeadsError('');

    try {
      const { data: rows, error } = await supabase
        .from('crm_leads')
        .select('id, source, status, name, phone, event_type, city, message, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const leads: Lead[] = (rows ?? []).map((row) => ({
        id: row.id,
        createdAt: row.created_at,
        source: row.source,
        status: row.status as Lead['status'],
        name: row.name,
        phone: row.phone,
        eventType: row.event_type,
        city: row.city,
        message: row.message,
      }));

      setData((current) => ({ ...current, leads }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load leads from Supabase.';
      setLeadsError(message);
    } finally {
      setLeadsLoading(false);
    }
  }, []);

  // Vendors and customers are stored in dedicated Supabase CRM tables.
  const loadSupabaseRegistrations = useCallback(async () => {
    setRegistrationsLoading(true);
    setRegistrationsError('');

    try {
      const [vendorResult, customerResult] = await Promise.all([
        supabase
          .from('crm_vendors')
          .select('id, created_at, status, name, phone, business, category, city, event, location, package_name, notes, payment_file')
          .order('created_at', { ascending: false }),
        supabase
          .from('crm_customers')
          .select('id, created_at, status, name, phone, interest, category, city, event, location, registration, notes')
          .order('created_at', { ascending: false }),
      ]);

      if (vendorResult.error) throw vendorResult.error;
      if (customerResult.error) throw customerResult.error;

      const vendors: Vendor[] = (vendorResult.data ?? []).map((row) => ({
        id: row.id,
        createdAt: row.created_at,
        status: row.status as Vendor['status'],
        name: row.name,
        phone: row.phone,
        business: row.business,
        category: row.category,
        city: row.city,
        event: row.event,
        location: row.location,
        packageName: row.package_name,
        notes: row.notes,
        paymentFile: row.payment_file,
      }));

      const customers: Customer[] = (customerResult.data ?? []).map((row) => ({
        id: row.id,
        createdAt: row.created_at,
        status: row.status as Customer['status'],
        name: row.name,
        phone: row.phone,
        interest: row.interest,
        category: row.category,
        city: row.city,
        event: row.event,
        location: row.location,
        registration: row.registration,
        notes: row.notes,
      }));

      setData((current) => ({ ...current, vendors, customers }));
    } catch (error) {
      setRegistrationsError(
        error instanceof Error ? error.message : 'Unable to load registrations from Supabase.'
      );
    } finally {
      setRegistrationsLoading(false);
    }
  }, []);

  const handleVendorStatusChange = async (id: string, status: Vendor['status']) => {
    try {
      const { error } = await supabase.from('crm_vendors').update({ status }).eq('id', id);
      if (error) throw error;
      await loadSupabaseRegistrations();
      flash('Vendor status updated');
    } catch (error) {
      flash(error instanceof Error ? `Could not update vendor: ${error.message}` : 'Could not update vendor.');
    }
  };

  const handleVendorDelete = async (id: string) => {
    if (!window.confirm('Delete this vendor record permanently?')) return;
    try {
      const { error } = await supabase.from('crm_vendors').delete().eq('id', id);
      if (error) throw error;
      await loadSupabaseRegistrations();
      flash('Vendor removed');
    } catch (error) {
      flash(error instanceof Error ? `Could not delete vendor: ${error.message}` : 'Could not delete vendor.');
    }
  };

  const handleCustomerStatusChange = async (id: string, status: Customer['status']) => {
    try {
      const { error } = await supabase.from('crm_customers').update({ status }).eq('id', id);
      if (error) throw error;
      await loadSupabaseRegistrations();
      flash('Customer status updated');
    } catch (error) {
      flash(error instanceof Error ? `Could not update customer: ${error.message}` : 'Could not update customer.');
    }
  };

  const handleCustomerDelete = async (id: string) => {
    if (!window.confirm('Delete this customer record permanently?')) return;
    try {
      const { error } = await supabase.from('crm_customers').delete().eq('id', id);
      if (error) throw error;
      await loadSupabaseRegistrations();
      flash('Customer removed');
    } catch (error) {
      flash(error instanceof Error ? `Could not delete customer: ${error.message}` : 'Could not delete customer.');
    }
  };

  // Refresh local CRM data when records change.
  useEffect(() => {
    const fn = () => refresh();

    addEventListener('exovia-crm-change', fn);
    addEventListener('storage', fn);

    return () => {
      removeEventListener('exovia-crm-change', fn);
      removeEventListener('storage', fn);
    };
  }, []);

  // Load shared website enquiries after the admin session is verified.
  useEffect(() => {
    if (profile) {
      void loadSupabaseLeads();
      void loadSupabaseRegistrations();
    }
  }, [profile?.id, loadSupabaseLeads, loadSupabaseRegistrations]);

  // Verify an existing Supabase session and its Exovia profile.
  useEffect(() => {
    let mounted = true;

    const verifySession = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (!session) {
          if (mounted) {
            setProfile(null);
            setAuthLoading(false);
          }
          return;
        }

        const { data: userProfile, error } = await supabase
          .from('users')
          .select('id, full_name, email, role, is_active')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!mounted) return;

        if (
          error ||
          !userProfile ||
          !userProfile.is_active ||
          !['super_admin', 'admin_client'].includes(userProfile.role)
        ) {
          await supabase.auth.signOut();

          if (mounted) {
            setProfile(null);
            setNotice(
              'Your account is not authorized for the Operations Center.'
            );
          }
        } else {
          setProfile(userProfile as AdminProfile);
        }
      } catch (error) {
        if (mounted) {
          setProfile(null);
          setNotice(
            error instanceof Error
              ? error.message
              : 'Unable to verify your session.'
          );
        }
      } finally {
        if (mounted) setAuthLoading(false);
      }
    };

    void verifySession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && mounted) {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2400);
  };

  const handleLeadStatusChange = async (id: string, status: Lead['status']) => {
    try {
      const { error } = await supabase
        .from('crm_leads')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      await loadSupabaseLeads();
      flash('Lead status updated');
    } catch (error) {
      flash(error instanceof Error ? `Could not update lead: ${error.message}` : 'Could not update lead.');
    }
  };

  const handleLeadDelete = async (id: string) => {
    if (!window.confirm('Delete this lead permanently?')) return;

    try {
      const { error } = await supabase
        .from('crm_leads')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadSupabaseLeads();
      flash('Lead removed');
    } catch (error) {
      flash(error instanceof Error ? `Could not delete lead: ${error.message}` : 'Could not delete lead.');
    }
  };

  const exportAll = () =>
    download(
      `exovia-crm-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(data, null, 2),
      'application/json'
    );

  // Authenticate using Supabase and verify the Exovia user profile.
  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setNotice('');
    setLoginLoading(true);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('Authentication failed. Please try again.');
      }

      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('id, full_name, email, role, is_active')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (profileError) {
        await supabase.auth.signOut();
        throw profileError;
      }

      if (!userProfile) {
        await supabase.auth.signOut();
        throw new Error(
          'No Exovia user profile found for this account.'
        );
      }

      if (!userProfile.is_active) {
        await supabase.auth.signOut();
        throw new Error(
          'Your account is inactive. Contact the administrator.'
        );
      }

      if (
        !['super_admin', 'admin_client'].includes(userProfile.role)
      ) {
        await supabase.auth.signOut();
        throw new Error(
          'You do not have access to the full Operations Center.'
        );
      }

      setProfile(userProfile as AdminProfile);
      setPassword('');
      setNotice('');
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Login failed. Please try again.'
      );
    } finally {
      setLoginLoading(false);
    }
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      flash('Unable to sign out. Please try again.');
      return;
    }

    setProfile(null);
    setPassword('');
    setEmail('');
    setNotice('');
  };

  // Session verification screen.
  if (authLoading) {
    return (
      <div className="adminAuth">
        <div className="adminAuthCard">
          <div className="adminBrand">
            EXOVIA <span>OPERATIONS CENTER</span>
          </div>
          <p>Verifying secure session...</p>
        </div>
      </div>
    );
  }

  // Supabase email/password login screen.
  if (!profile) {
    return (
      <div className="adminAuth">
        <div className="adminAuthCard">
          <div className="adminBrand">
            EXOVIA <span>OPERATIONS CENTER</span>
          </div>

          <div className="adminKicker">SECURE ADMIN LOGIN</div>

          <h1>Run the event company.</h1>

          <p>
            Sign in with your authorized Exovia account to manage
            enquiries, vendors, customers, events and operations.
          </p>

          <form onSubmit={handleLogin}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Admin email"
              autoComplete="username"
              required
            />

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              required
            />

            <button type="submit" disabled={loginLoading}>
              {loginLoading
                ? 'Signing in...'
                : 'Sign in to Operations Center ↗'}
            </button>
          </form>

          {notice && <small role="alert">{notice}</small>}

          <a href="/">← Back to Exovia website</a>
        </div>
      </div>
    );
  }

  // Existing Operations Center dashboard.
  return (
    <div className="adminShell">
      <aside className="adminSide">
        <a href="/" className="adminLogo">
          EXOVIA <small>EVENTS</small>
        </a>

        <div className="adminSideTitle">OPERATIONS</div>

        {tabs.map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? 'active' : ''}
            onClick={() => setTab(id)}
          >
            {label}
            <span>
              {id === 'overview'
                ? ''
                : ({
                    leads: data.leads.length,
                    vendors: data.vendors.length,
                    customers: data.customers.length,
                    events: data.events.length,
                    payments: data.payments.length,
                    tasks: data.tasks.filter(
                      (x) => x.status !== 'done'
                    ).length,
                  } as any)[id]}
            </span>
          </button>
        ))}

        <div className="adminSideBottom">
          <a href="/" target="_blank" rel="noreferrer">
            View website ↗
          </a>

          <button onClick={exportAll}>Export CRM ↓</button>
          <button onClick={logout}>Sign out</button>
        </div>
      </aside>

      <main className="adminMain">
        <header className="adminTop">
          <div>
            <div className="adminKicker">
              EXOVIA / OPERATIONS CENTER
            </div>
            <h1>{tabs.find((x) => x[0] === tab)?.[1]}</h1>
            <small>{profile.full_name} · {profile.role}</small>
          </div>

          <div className="adminTopActions">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people, events, city…"
            />
            <span className="liveDot">● LIVE LOCAL DATA</span>
          </div>
        </header>

        {notice && <div className="adminNotice">{notice}</div>}

        {tab === 'overview' && (
          <Overview data={data} setTab={setTab} />
        )}

        {tab === 'leads' && (
          <LeadManager
            data={data}
            query={query}
            flash={flash}
            loading={leadsLoading}
            error={leadsError}
            onRefresh={loadSupabaseLeads}
            onStatusChange={handleLeadStatusChange}
            onDelete={handleLeadDelete}
          />
        )}

        {tab === 'vendors' && (
          <VendorManager
            data={data}
            query={query}
            loading={registrationsLoading}
            error={registrationsError}
            onRefresh={loadSupabaseRegistrations}
            onStatusChange={handleVendorStatusChange}
            onDelete={handleVendorDelete}
          />
        )}

        {tab === 'customers' && (
          <CustomerManager
            data={data}
            query={query}
            loading={registrationsLoading}
            error={registrationsError}
            onRefresh={loadSupabaseRegistrations}
            onStatusChange={handleCustomerStatusChange}
            onDelete={handleCustomerDelete}
          />
        )}

        {tab === 'events' && (
          <EventManager data={data} flash={flash} />
        )}

        {tab === 'eventBookings' && (
          <EventBookingsManager query={query} flash={flash} />
        )}

        {tab === 'payments' && (
          <PaymentManager data={data} flash={flash} />
        )}

        {tab === 'tasks' && (
          <TaskManager data={data} flash={flash} />
        )}
      </main>
    </div>
  );
}

function Overview({
  data,
  setTab,
}: {
  data: CRMState;
  setTab: (t: Tab) => void;
}) {
  const total = data.payments.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="adminContent">
     
<div
  className="metricGrid"
  style={{
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: 16,
    margin: '24px 0',
  }}
>
  {[
    {
      label: 'Total Leads',
      value: data.leads.length,
    },
    {
      label: 'Vendors',
      value: data.vendors.length,
    },
    {
      label: 'Customers',
      value: data.customers.length,
    },
    {
      label: 'Events',
      value: data.events.length,
    },
    {
      label: 'Payments',
      value: data.payments.length,
    },
  ].map(({ label, value }) => (
    <div
      className="metric"
      key={label}
      style={{
        padding: '20px',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 14,
        background: 'rgba(255,255,255,0.035)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <span style={{ fontSize: 13, opacity: 0.7 }}>{label}</span>
      <strong style={{ fontSize: 30 }}>{value}</strong>
    </div>
  ))}
</div>


      <div className="adminColumns">
        <section className="panel">
          <div className="panelHead">
            <div>
              <span>RECENT ENQUIRIES</span>
              <h2>Leads that need attention.</h2>
            </div>
            <button onClick={() => setTab('leads')}>View all ↗</button>
          </div>

          {data.leads.slice(0, 5).map((l) => (
            <div className="row" key={l.id}>
              <div>
                <b>{l.name}</b>
                <small>
                  {l.eventType} · {l.city || 'No city'}
                </small>
              </div>
              <em className={`status ${l.status}`}>{l.status}</em>
            </div>
          ))}

          {!data.leads.length && (
            <Empty text="Website enquiries will appear here." />
          )}
        </section>

        <section className="panel">
          <div className="panelHead">
            <div>
              <span>FINANCE</span>
              <h2>Payment register.</h2>
            </div>
            <button onClick={() => setTab('payments')}>Manage ↗</button>
          </div>

          <div className="bigNumber">
            ₹{total.toLocaleString('en-IN')}
          </div>

          <p className="muted">
            Recorded payment activity. Mark records as pending, paid
            or verified from Payments.
          </p>
        </section>
      </div>

      <section className="panel">
        <div className="panelHead">
          <div>
            <span>EVENT PIPELINE</span>
            <h2>Upcoming operations.</h2>
          </div>
          <button onClick={() => setTab('events')}>
            Manage events ↗
          </button>
        </div>

        <div className="miniGrid">
          {data.events.slice(0, 4).map((e) => (
            <div className="eventMini" key={e.id}>
              <b>{e.name}</b>
              <span>
                {e.date || 'Date TBD'} · {e.city || 'City TBD'}
              </span>
              <em>{e.status}</em>
            </div>
          ))}

          {!data.events.length && (
            <Empty text="Create your first event." />
          )}
        </div>
      </section>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}

function SearchNo({ text }: { text: string }) {
  return <div className="empty">No records match “{text}”.</div>;
}

function LeadManager({
  data,
  query,
  loading,
  error,
  onRefresh,
  onStatusChange,
  onDelete,
  flash: _flash,
}: {
  data: CRMState;
  query: string;
  loading: boolean;
  error: string;
  onRefresh: () => Promise<void>;
  onStatusChange: (id: string, status: Lead['status']) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  flash: (message: string) => void;
}) {
  const rows = data.leads.filter((x) =>
    JSON.stringify(x).toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="adminContent">
      <section className="panel">
        <div className="panelHead">
          <div>
            <span>WEBSITE CRM · SUPABASE</span>
            <h2>Event enquiries</h2>
          </div>
          <div className="formActions">
            <button onClick={() => void onRefresh()} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh ↻'}
            </button>
            <button
              onClick={() =>
                download('exovia-leads.csv', csv(data.leads), 'text/csv')
              }
              disabled={!data.leads.length}
            >
              Export CSV ↓
            </button>
          </div>
        </div>

        {error && (
          <div className="adminNotice" role="alert">
            Could not load Supabase leads: {error}
          </div>
        )}

        {loading && !data.leads.length && <Empty text="Loading enquiries from Supabase…" />}

        {!loading && !error && rows.length === 0 && (
          query ? <SearchNo text={query} /> : <Empty text="No website enquiries yet." />
        )}

        {rows.map((l) => (
          <div className="dataRow" key={l.id}>
            <div className="dataMain">
              <b>{l.name}</b>
              <span>
                {l.phone} · {l.eventType} · {l.city || '—'}
              </span>
              <small>{l.message || 'No message'} · {l.source}</small>
            </div>

            <select
              value={l.status}
              disabled={loading}
              onChange={(e) =>
                void onStatusChange(l.id, e.target.value as Lead['status'])
              }
            >
              <option value="new">new</option>
              <option value="contacted">contacted</option>
              <option value="qualified">qualified</option>
              <option value="closed">closed</option>
            </select>

            <button
              className="danger"
              disabled={loading}
              onClick={() => void onDelete(l.id)}
              aria-label={`Delete lead ${l.name}`}
            >
              ×
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}

function VendorManager({
  data,
  query,
  loading,
  error,
  onRefresh,
  onStatusChange,
  onDelete,
}: {
  data: CRMState;
  query: string;
  loading: boolean;
  error: string;
  onRefresh: () => Promise<void>;
  onStatusChange: (id: string, status: Vendor['status']) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [screenshotLoading, setScreenshotLoading] = useState<string | null>(null);

  const openPaymentScreenshot = async (path: string) => {
    setScreenshotLoading(path);
    try {
      const { data: signed, error: signedError } = await supabase.storage
        .from('vendor-payment-screenshots')
        .createSignedUrl(path, 60);

      if (signedError) throw signedError;
      if (!signed?.signedUrl) throw new Error('Screenshot link could not be created.');
      setScreenshotPreview(signed.signedUrl);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to open payment screenshot.');
    } finally {
      setScreenshotLoading(null);
    }
  };

  const rows = data.vendors.filter((x) =>
    JSON.stringify(x).toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="adminContent">
      <section className="panel">
        <div className="panelHead">
          <div>
            <span>PARTNER CRM · SUPABASE</span>
            <h2>Vendor & stall records</h2>
          </div>
          <div className="formActions">
            <button onClick={() => void onRefresh()} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh ↻'}
            </button>
            <button
              onClick={() => download('exovia-vendors.csv', csv(data.vendors), 'text/csv')}
              disabled={!data.vendors.length}
            >
              Export CSV ↓
            </button>
          </div>
        </div>

        {error && <div className="adminNotice" role="alert">Could not load Supabase registrations: {error}</div>}
        {loading && !data.vendors.length && <Empty text="Loading vendors from Supabase…" />}
        {!loading && !error && rows.length === 0 && (
          query ? <SearchNo text={query} /> : <Empty text="No vendor registrations yet." />
        )}

        {rows.map((v) => (
          <div className="dataRow" key={v.id}>
            <div className="dataMain">
              <b>{v.business || v.name}</b>
              <span>{v.name} · {v.phone} · {v.category || 'Uncategorised'}</span>
              <small>{v.city || '—'} · {v.event || 'No event'} · {v.location || 'No area'} · {v.packageName || 'No package'}</small>
              {v.paymentFile && (
  <small>Payment screenshot attached · Path: {v.paymentFile}</small>
)}
            </div>
            {v.paymentFile?.startsWith('vendors/') ? (
              <button
                type="button"
                disabled={screenshotLoading === v.paymentFile}
                onClick={() => void openPaymentScreenshot(v.paymentFile)}
              >
                {screenshotLoading === v.paymentFile ? 'Opening…' : 'View Screenshot ↗'}
              </button>
            ) : v.paymentFile ? (
              <small>Old file reference (image not stored)</small>
            ) : (
              <small>No screenshot</small>
            )}
            <select
              value={v.status}
              disabled={loading}
              onChange={(e) => void onStatusChange(v.id, e.target.value as Vendor['status'])}
            >
              <option value="new">new</option>
              <option value="approved">approved</option>
              <option value="hold">hold</option>
              <option value="rejected">rejected</option>
            </select>
            <button className="danger" disabled={loading} onClick={() => void onDelete(v.id)} aria-label={`Delete vendor ${v.name}`}>×</button>
          </div>
        ))}
      </section>

      {screenshotPreview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Payment screenshot preview"
          onClick={() => setScreenshotPreview(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,.86)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div onClick={(event) => event.stopPropagation()} style={{ position: 'relative', maxWidth: 'min(920px, 95vw)', maxHeight: '90vh', background: '#111', border: '1px solid rgba(255,255,255,.18)', borderRadius: 14, padding: 16 }}>
            <button type="button" onClick={() => setScreenshotPreview(null)} style={{ display: 'block', marginLeft: 'auto', marginBottom: 12 }}>Close ×</button>
            <img src={screenshotPreview} alt="Vendor payment screenshot" style={{ display: 'block', maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain' }} />
            <a href={screenshotPreview} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 12 }}>Open image in new tab ↗</a>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomerManager({
  data,
  query,
  loading,
  error,
  onRefresh,
  onStatusChange,
  onDelete,
}: {
  data: CRMState;
  query: string;
  loading: boolean;
  error: string;
  onRefresh: () => Promise<void>;
  onStatusChange: (id: string, status: Customer['status']) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const rows = data.customers.filter((x) =>
    JSON.stringify(x).toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="adminContent">
      <section className="panel">
        <div className="panelHead">
          <div>
            <span>CUSTOMER CRM · SUPABASE</span>
            <h2>Visitor & registration records</h2>
          </div>
          <div className="formActions">
            <button onClick={() => void onRefresh()} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh ↻'}
            </button>
            <button
              onClick={() => download('exovia-customers.csv', csv(data.customers), 'text/csv')}
              disabled={!data.customers.length}
            >
              Export CSV ↓
            </button>
          </div>
        </div>

        {error && <div className="adminNotice" role="alert">Could not load Supabase registrations: {error}</div>}
        {loading && !data.customers.length && <Empty text="Loading customers from Supabase…" />}
        {!loading && !error && rows.length === 0 && (
          query ? <SearchNo text={query} /> : <Empty text="No customer registrations yet." />
        )}

        {rows.map((c) => (
          <div className="dataRow" key={c.id}>
            <div className="dataMain">
              <b>{c.name}</b>
              <span>{c.phone} · {c.interest || 'General interest'}</span>
              <small>{c.city || '—'} · {c.event || 'No event'} · {c.location || 'No area'} · {c.registration || 'No registration type'}</small>
            </div>
            <select
              value={c.status}
              disabled={loading}
              onChange={(e) => void onStatusChange(c.id, e.target.value as Customer['status'])}
            >
              <option value="new">new</option>
              <option value="registered">registered</option>
              <option value="attended">attended</option>
              <option value="closed">closed</option>
            </select>
            <button className="danger" disabled={loading} onClick={() => void onDelete(c.id)} aria-label={`Delete customer ${c.name}`}>×</button>
          </div>
        ))}
      </section>
    </div>
  );
}


function EventManager({
  flash,
}: {
  data: CRMState;
  flash: (s: string) => void;
}) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [ticketForm, setTicketForm] = useState({
    name: 'General Admission',
    price: '',
    capacity: '100',
  });
  const [dateForm, setDateForm] = useState({
    date: '',
    starts: '',
    ends: '',
    capacity: '100',
  });

  const [form, setForm] = useState({
    name: '',
    type: 'Food & Flea Market',
    description: '',
    city: UP_EVENT_LOCATIONS[0],
    venue: '',
    date: '',
    starts: '',
    ends: '',
    capacity: '100',
    price: '',
    status: 'booking_open',
  });

  const loadEvents = async () => {
    setLoading(true);
    try {
      const { data: rows, error } = await supabase
        .from('events')
        .select(`
          id, name, slug, description, category, city, venue,
          status, public_visible, customer_registration_enabled,
          event_dates (
            id, event_date, starts_at, ends_at,
            total_capacity, is_open
          ),
          event_customer_tickets (
            id, event_date_id, ticket_name, description,
            price_paise, capacity, active
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEvents(rows || []);
    } catch (error) {
      flash(error instanceof Error ? error.message : 'Unable to load events.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEvents();
  }, []);

  const makeSlug = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') +
    '-' +
    crypto.randomUUID().slice(0, 8);

  const createEvent = async () => {
    if (!form.name.trim() || !form.date || !form.city.trim()) {
      flash('Please enter event name, date and city.');
      return;
    }

    const price = form.price.trim() === '' ? null : Number(form.price);

    if (price !== null && (!Number.isFinite(price) || price < 0)) {
      flash('Enter a valid ticket price.');
      return;
    }

    const capacity = Number(form.capacity);
    if (!Number.isInteger(capacity) || capacity < 0) {
      flash('Enter a valid event capacity.');
      return;
    }

    setSaving(true);

    try {
      const isOpen = form.status === 'booking_open';

      const { data: created, error } = await supabase
        .from('events')
        .insert({
          name: form.name.trim(),
          slug: makeSlug(form.name),
          description: form.description.trim(),
          category: form.type,
          city: form.city,
          venue: form.venue.trim() || null,
          status: form.status,
          public_visible: form.status !== 'draft',
          customer_registration_enabled: isOpen,
          starts_at: form.starts
            ? `${form.date}T${form.starts}:00`
            : `${form.date}T00:00:00`,
          ends_at: form.ends
            ? `${form.date}T${form.ends}:00`
            : null,
        })
        .select('id')
        .single();

      if (error) throw error;

      const { data: createdDate, error: dateError } = await supabase
        .from('event_dates')
        .insert({
          event_id: created.id,
          event_date: form.date,
          starts_at: form.starts || null,
          ends_at: form.ends || null,
          total_capacity: capacity,
          is_open: isOpen,
        })
        .select('id')
        .single();

      if (dateError) throw dateError;

      const { error: ticketError } = await supabase
        .from('event_customer_tickets')
        .insert({
          event_id: created.id,
          event_date_id: createdDate.id,
          ticket_name: 'General Admission',
          price_paise: price === null ? null : Math.round(price * 100),
          capacity,
          active: true,
        });

      if (ticketError) throw ticketError;

      setForm({
        name: '',
        type: 'Food & Flea Market',
        description: '',
        city: UP_EVENT_LOCATIONS[0],
        venue: '',
        date: '',
        starts: '',
        ends: '',
        capacity: '100',
        price: '',
        status: 'booking_open',
      });

      setOpen(false);
      await loadEvents();
      flash('Event, date and ticket created successfully.');
    } catch (error) {
      flash(error instanceof Error ? error.message : 'Could not create event.');
    } finally {
      setSaving(false);
    }
  };

  const addDate = async (event: any) => {
    if (!dateForm.date) {
      flash('Select an event date.');
      return;
    }

    const capacity = Number(dateForm.capacity);
    if (!Number.isInteger(capacity) || capacity < 0) {
      flash('Enter a valid capacity.');
      return;
    }

    setSaving(true);

    try {
      const isOpen =
        event.status === 'booking_open' &&
        event.customer_registration_enabled;

      const { data: createdDate, error } = await supabase
        .from('event_dates')
        .insert({
          event_id: event.id,
          event_date: dateForm.date,
          starts_at: dateForm.starts || null,
          ends_at: dateForm.ends || null,
          total_capacity: capacity,
          is_open: isOpen,
        })
        .select('id')
        .single();

      if (error) throw error;

      const price = ticketForm.price.trim() === ''
        ? null
        : Number(ticketForm.price);

      if (price !== null && (!Number.isFinite(price) || price < 0)) {
        throw new Error('Enter a valid ticket price.');
      }

      const { error: ticketError } = await supabase
        .from('event_customer_tickets')
        .insert({
          event_id: event.id,
          event_date_id: createdDate.id,
          ticket_name: ticketForm.name.trim() || 'General Admission',
          price_paise: price === null ? null : Math.round(price * 100),
          capacity,
          active: true,
        });

      if (ticketError) throw ticketError;

      setDateForm({ date: '', starts: '', ends: '', capacity: '100' });
      setTicketForm({ name: 'General Admission', price: '', capacity: '100' });
      setSelectedEvent(null);
      await loadEvents();
      flash('New event date and ticket added.');
    } catch (error) {
      flash(error instanceof Error ? error.message : 'Could not add date.');
    } finally {
      setSaving(false);
    }
  };

  const updateTicketPrice = async (ticket: any) => {
    const current = ticket.price_paise == null
      ? ''
      : String(Number(ticket.price_paise) / 100);

    const value = window.prompt(
      'Enter new ticket price in INR. Leave blank to make this ticket FREE.',
      current
    );

    if (value === null) return;

    const price = value.trim() === '' ? null : Number(value);

    if (price !== null && (!Number.isFinite(price) || price < 0)) {
      flash('Enter a valid price.');
      return;
    }

    try {
      const { error } = await supabase
        .from('event_customer_tickets')
        .update({
          price_paise: price === null ? null : Math.round(price * 100),
          updated_at: new Date().toISOString(),
        })
        .eq('id', ticket.id);

      if (error) throw error;

      await loadEvents();
      flash(price === null ? 'Ticket is now free.' : 'Ticket price updated.');
    } catch (error) {
      flash(error instanceof Error ? error.message : 'Price update failed.');
    }
  };

  const changeEventStatus = async (event: any, status: string) => {
    try {
      const isOpen = status === 'booking_open';

      const { error } = await supabase
        .from('events')
        .update({
          status,
          public_visible: status !== 'draft' && status !== 'archived',
          customer_registration_enabled: isOpen,
          updated_at: new Date().toISOString(),
        })
        .eq('id', event.id);

      if (error) throw error;

      const { error: dateError } = await supabase
        .from('event_dates')
        .update({ is_open: isOpen })
        .eq('event_id', event.id);

      if (dateError) throw dateError;

      await loadEvents();
      flash('Event booking status updated.');
    } catch (error) {
      flash(error instanceof Error ? error.message : 'Status update failed.');
    }
  };

  return (
    <div className="adminContent">
      <section className="panel">
        <div className="panelHead">
          <div>
            <span>LIVE EVENT MANAGEMENT · SUPABASE</span>
            <h2>Events, dates & customer ticketing</h2>
            <p className="panelSub">
              Create events, manage multiple dates and control ticket prices.
            </p>
          </div>
          <div className="formActions">
            <button onClick={() => void loadEvents()} disabled={loading}>
              {loading ? 'Loading…' : 'Refresh ↻'}
            </button>
            <button onClick={() => setOpen(!open)}>+ New event</button>
          </div>
        </div>

        {open && (
          <div className="inlineForm">
            <label className="wide">
              Event name
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Lucknow Food & Flea Festival"
              />
            </label>

            <label>
              Event category
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option>Food & Flea Market</option>
                <option>Wedding</option>
                <option>Corporate Event</option>
                <option>Exhibition / Pop-up</option>
                <option>Festival / Large Event</option>
                <option>Private Party</option>
                <option>Other</option>
              </select>
            </label>

            <label>
              City
              <select
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              >
                {UP_EVENT_LOCATIONS.map((x) => <option key={x}>{x}</option>)}
              </select>
            </label>

            <label>
              Venue
              <input
                value={form.venue}
                onChange={(e) => setForm({ ...form, venue: e.target.value })}
                placeholder="Venue / ground / location"
              />
            </label>

            <label>
              First event date
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </label>

            <label>
              Start time
              <input
                type="time"
                value={form.starts}
                onChange={(e) => setForm({ ...form, starts: e.target.value })}
              />
            </label>

            <label>
              End time
              <input
                type="time"
                value={form.ends}
                onChange={(e) => setForm({ ...form, ends: e.target.value })}
              />
            </label>

            <label>
              Total capacity
              <input
                type="number"
                min="0"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              />
            </label>

            <label>
              General ticket price (₹)
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Leave blank for free"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </label>

            <label>
              Booking status
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="booking_open">Booking Open</option>
                <option value="published">Published · Booking Closed</option>
                <option value="draft">Draft · Private</option>
              </select>
            </label>

            <label className="wide">
              Event description
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Describe the event for customers..."
              />
            </label>

            <div className="publishHint">
              <b>Multiple dates:</b> You can add more dates after creating this event.
              A blank ticket price means free registration.
            </div>

            <div className="formActions">
              <button onClick={() => void createEvent()} disabled={saving}>
                {saving ? 'Creating…' : 'Create event ↗'}
              </button>
              <button className="ghostBtn" onClick={() => setOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading && !events.length && <Empty text="Loading events from Supabase…" />}

        {!loading && !events.length && (
          <Empty text="No database events yet. Create your first event above." />
        )}

        {events.map((event) => (
          <div key={event.id} className="panel" style={{ marginTop: 18 }}>
            <div className="panelHead">
              <div>
                <span>{event.category || 'EVENT'} · {event.city}</span>
                <h2>{event.name}</h2>
                <p className="panelSub">{event.venue || 'Venue not set'}</p>
              </div>

              <select
                value={event.status}
                onChange={(e) => void changeEventStatus(event, e.target.value)}
              >
                <option value="draft">Draft</option>
                <option value="published">Published · Closed</option>
                <option value="booking_open">Booking Open</option>
                <option value="booking_closed">Booking Closed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="dataMain">
              <small>{event.description || 'No description added.'}</small>
            </div>

            <div className="formActions" style={{ marginTop: 14 }}>
              <button onClick={() => setSelectedEvent(
                selectedEvent?.id === event.id ? null : event
              )}>
                {selectedEvent?.id === event.id ? 'Close date form' : '+ Add another date'}
              </button>
            </div>

            {selectedEvent?.id === event.id && (
              <div className="inlineForm">
                <label>
                  New date
                  <input
                    type="date"
                    value={dateForm.date}
                    onChange={(e) => setDateForm({ ...dateForm, date: e.target.value })}
                  />
                </label>
                <label>
                  Start time
                  <input
                    type="time"
                    value={dateForm.starts}
                    onChange={(e) => setDateForm({ ...dateForm, starts: e.target.value })}
                  />
                </label>
                <label>
                  End time
                  <input
                    type="time"
                    value={dateForm.ends}
                    onChange={(e) => setDateForm({ ...dateForm, ends: e.target.value })}
                  />
                </label>
                <label>
                  Capacity
                  <input
                    type="number"
                    min="0"
                    value={dateForm.capacity}
                    onChange={(e) => setDateForm({ ...dateForm, capacity: e.target.value })}
                  />
                </label>
                <label>
                  Ticket name
                  <input
                    value={ticketForm.name}
                    onChange={(e) => setTicketForm({ ...ticketForm, name: e.target.value })}
                  />
                </label>
                <label>
                  Ticket price (₹)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Blank = Free"
                    value={ticketForm.price}
                    onChange={(e) => setTicketForm({ ...ticketForm, price: e.target.value })}
                  />
                </label>
                <div className="formActions">
                  <button onClick={() => void addDate(event)} disabled={saving}>
                    {saving ? 'Saving…' : 'Save date & ticket'}
                  </button>
                </div>
              </div>
            )}

            {(event.event_dates || []).map((date: any) => (
              <div className="dataRow" key={date.id}>
                <div className="dataMain">
                  <b>{date.event_date}</b>
                  <span>
                    {date.starts_at || 'Time TBD'} · {date.ends_at || ''}
                    · Capacity {date.total_capacity}
                  </span>
                  <small>{date.is_open ? 'Bookings open' : 'Bookings closed'}</small>
                </div>

                {(event.event_customer_tickets || [])
                  .filter((ticket: any) => ticket.event_date_id === date.id)
                  .map((ticket: any) => (
                    <div key={ticket.id} className="dataMain">
                      <b>{ticket.ticket_name}</b>
                      <span>
                        {ticket.price_paise == null
                          ? 'FREE'
                          : `₹${(Number(ticket.price_paise) / 100).toLocaleString('en-IN')}`}
                        {' · '}Capacity {ticket.capacity}
                      </span>
                      <button onClick={() => void updateTicketPrice(ticket)}>
                        Change price ↗
                      </button>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}



function EventBookingsManager({
  query,
  flash,
}: {
  query: string;
  flash: (message: string) => void;
}) {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadBookings = async () => {
    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase
        .from('event_customer_bookings')
        .select(`
          id,
          booking_code,
          event_id,
          event_date_id,
          ticket_id,
          customer_name,
          phone,
          email,
          attendee_count,
          unit_price_paise,
          total_price_paise,
          status,
          notes,
          created_at,
          event:events!event_customer_bookings_event_id_fkey(name),
          date:event_dates!event_customer_bookings_event_date_id_fkey(event_date),
          ticket:event_customer_bookings_ticket_id_fkey(ticket_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setBookings(data || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load event bookings.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBookings();
  }, []);

  const changeStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from('event_customer_bookings')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      await loadBookings();
      flash('Event booking status updated.');
    } catch (err) {
      flash(
        err instanceof Error
          ? `Could not update booking: ${err.message}`
          : 'Could not update booking.'
      );
    }
  };

  const filtered = bookings.filter((booking) =>
    [
      booking.booking_code,
      booking.customer_name,
      booking.phone,
      booking.email,
      booking.event?.name,
      booking.ticket?.ticket_name,
      booking.status,
    ]
      .join(' ')
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  const money = (paise: number | null) =>
    paise == null
      ? 'FREE'
      : `₹${(Number(paise) / 100).toLocaleString('en-IN')}`;

  return (
    <div className="adminContent">
      <section className="panel">
        <div className="panelHead">
          <div>
            <span>CUSTOMER OPERATIONS · SUPABASE</span>
            <h2>Event customer bookings</h2>
            <p className="panelSub">
              View registrations and manage attendee booking statuses.
            </p>
          </div>

          <button onClick={() => void loadBookings()} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh ↻'}
          </button>
        </div>

        
<div
  style={{
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
    gap: '16px',
    margin: '24px 0',
  }}
>
  {[
    ['Total Bookings', bookings.length],
    ['Registered', bookings.filter(x => x.status === 'registered').length],
    ['Confirmed', bookings.filter(x => x.status === 'confirmed').length],
    ['Attended', bookings.filter(x => x.status === 'attended').length],
    ['Cancelled', bookings.filter(x => x.status === 'cancelled').length],
  ].map(([label, value]) => (
    <div
      key={String(label)}
      style={{
        padding: '22px',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '14px',
        background: 'rgba(255,255,255,0.035)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <span style={{ fontSize: '13px', color: '#999' }}>
        {label}
      </span>
      <strong style={{ fontSize: '30px', color: '#fff' }}>
        {value}
      </strong>
    </div>
  ))}
</div>


        {error && (
          <div className="adminNotice" role="alert">
            Could not load event bookings: {error}
          </div>
        )}

        {loading && !bookings.length && (
          <Empty text="Loading event bookings…" />
        )}

        {!loading && !error && filtered.length === 0 && (
          <Empty
            text={
              query
                ? 'No matching event bookings.'
                : 'No customer event registrations yet.'
            }
          />
        )}

        {filtered.map((booking) => (
          <div className="dataRow" key={booking.id}>
            <div className="dataMain">
              <b>{booking.customer_name}</b>
              <span>{booking.phone}</span>
              {booking.email && <span>{booking.email}</span>}

              <small>
                Booking: {booking.booking_code}
              </small>

              <small>
                Event: {booking.event?.name || 'Event unavailable'}
              </small>

              <small>
                Date: {booking.date?.event_date || 'Not specified'}
                {' · '}
                Ticket: {booking.ticket?.ticket_name || 'Ticket unavailable'}
              </small>

              <small>
                Attendees: {booking.attendee_count}
                {' · '}
                Total: {money(booking.total_price_paise)}
              </small>

              <small>
                Registered: {new Date(booking.created_at).toLocaleString('en-IN')}
              </small>

              {booking.notes && (
                <small>Notes: {booking.notes}</small>
              )}
            </div>

            <select
              value={booking.status}
              onChange={(e) =>
                void changeStatus(booking.id, e.target.value)
              }
              aria-label={`Status for ${booking.customer_name}`}
            >
              <option value="registered">Registered</option>
              <option value="confirmed">Confirmed</option>
              <option value="cancelled">Cancelled</option>
              <option value="attended">Attended</option>
            </select>
          </div>
        ))}
      </section>
    </div>
  );
}


function PaymentManager({
  data,
  flash,
}: {
  data: CRMState;
  flash: (s: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const [f, setF] = useState({
    party: '',
    type: 'vendor',
    amount: '',
    reference: '',
    notes: '',
    status: 'pending',
  });

  const create = () => {
    if (!f.party || !f.amount) return;

    addCRM('payments', {
      ...f,
      id: makeId('pay'),
      createdAt: new Date().toISOString(),
      amount: Number(f.amount),
    } as any);

    setF({
      party: '',
      type: 'vendor',
      amount: '',
      reference: '',
      notes: '',
      status: 'pending',
    });

    setOpen(false);
    flash('Payment record created');
  };

  return (
    <div className="adminContent">
      <section className="panel">
        <div className="panelHead">
          <div>
            <span>FINANCE CONTROL</span>
            <h2>Payments & reconciliation</h2>
          </div>

          <button onClick={() => setOpen(!open)}>
            + Record payment
          </button>
        </div>

        {open && (
          <div className="inlineForm">
            <label>
              Party
              <input
                value={f.party}
                onChange={(e) =>
                  setF({ ...f, party: e.target.value })
                }
              />
            </label>

            <label>
              Type
              <select
                value={f.type}
                onChange={(e) =>
                  setF({ ...f, type: e.target.value })
                }
              >
                <option>vendor</option>
                <option>customer</option>
                <option>expense</option>
              </select>
            </label>

            <label>
              Amount
              <input
                type="number"
                value={f.amount}
                onChange={(e) =>
                  setF({ ...f, amount: e.target.value })
                }
              />
            </label>

            <label>
              Reference
              <input
                value={f.reference}
                onChange={(e) =>
                  setF({ ...f, reference: e.target.value })
                }
              />
            </label>

            <label>
              Status
              <select
                value={f.status}
                onChange={(e) =>
                  setF({ ...f, status: e.target.value })
                }
              >
                <option>pending</option>
                <option>paid</option>
                <option>verified</option>
              </select>
            </label>

            <label className="wide">
              Notes
              <textarea
                value={f.notes}
                onChange={(e) =>
                  setF({ ...f, notes: e.target.value })
                }
              />
            </label>

            <div className="formActions">
              <button onClick={create}>Save payment</button>
            </div>
          </div>
        )}

        {data.payments.map((p) => (
          <div className="dataRow" key={p.id}>
            <div className="dataMain">
              <b>
                ₹{p.amount.toLocaleString('en-IN')} · {p.party}
              </b>
              <span>
                {p.type} · {p.reference || 'No reference'}
              </span>
              <small>{p.notes || 'No notes'}</small>
            </div>

            <select
              value={p.status}
              onChange={(e) => {
                updateCRM('payments', p.id, {
                  status: e.target.value as any,
                });
                flash('Payment status updated');
              }}
            >
              <option>pending</option>
              <option>paid</option>
              <option>verified</option>
            </select>

            <button
              className="danger"
              onClick={() => {
                removeCRM('payments', p.id);
                flash('Payment removed');
              }}
            >
              ×
            </button>
          </div>
        ))}

        {!data.payments.length && !open && (
          <Empty text="No payment records yet." />
        )}
      </section>
    </div>
  );
}

function TaskManager({
  data,
  flash,
}: {
  data: CRMState;
  flash: (s: string) => void;
}) {
  const [title, setTitle] = useState('');

  const add = () => {
    if (!title.trim()) return;

    addCRM('tasks', {
      id: makeId('task'),
      createdAt: new Date().toISOString(),
      title,
      owner: 'Admin',
      due: '',
      status: 'todo',
      priority: 'medium',
    });

    setTitle('');
    flash('Task added');
  };

  return (
    <div className="adminContent">
      <section className="panel">
        <div className="panelHead">
          <div>
            <span>DAILY OPERATIONS</span>
            <h2>Tasks & follow-ups</h2>
          </div>

          <div className="quickAdd">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add a task…"
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
            <button onClick={add}>Add</button>
          </div>
        </div>

        {data.tasks.map((t) => (
          <div className="dataRow" key={t.id}>
            <div className="dataMain">
              <b>{t.title}</b>
              <span>
                {t.owner} · {t.due || 'No due date'}
              </span>
            </div>

            <select
              value={t.status}
              onChange={(e) => {
                updateCRM('tasks', t.id, {
                  status: e.target.value as any,
                });
                flash('Task updated');
              }}
            >
              <option>todo</option>
              <option>progress</option>
              <option>done</option>
            </select>

            <button
              className="danger"
              onClick={() => {
                removeCRM('tasks', t.id);
                flash('Task removed');
              }}
            >
              ×
            </button>
          </div>
        ))}

        {!data.tasks.length && (
          <Empty text="No operational tasks. Add one above." />
        )}
      </section>
    </div>
  );
}

export default Admin;
