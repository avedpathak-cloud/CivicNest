import { useEffect, useState } from 'react';
import { apiRequest, loadCachedBootstrap, uploadSocialImage } from './api/client';
import { AppShell, type NavTabId } from './components/AppShell';
import type { BootstrapPayload, LanguageCode } from './types/society';
import { AmenitiesEventsView } from './views/AmenitiesEventsView';
import { FinanceView } from './views/FinanceView';
import { FlatDirectoryProfileView } from './views/FlatDirectoryProfileView';
import { GovernanceView } from './views/GovernanceView';
import { HomeView } from './views/HomeView';
import { OperationsView } from './views/OperationsView';
import { ServicesMarketplaceView } from './views/ServicesMarketplaceView';
import { TicketsView } from './views/TicketsView';

export default function App() {
  const [userId, setUserId] = useState<string>('usr_secretary');
  const [activeTab, setActiveTab] = useState<NavTabId>('home');
  const [data, setData] = useState<BootstrapPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<LanguageCode>('en');
  const [darkMode, setDarkMode] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [createTicketOpen, setCreateTicketOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiRequest<BootstrapPayload>('/api/bootstrap', userId)
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
        setLang(payload.currentUser.preferredLang || 'en');
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        const cached = loadCachedBootstrap(userId);
        if (cached) {
          setData(cached);
          setLoading(false);
        } else {
          setError(err instanceof Error ? err.message : 'Unable to reach CivicNest server.');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleSwitchUser = (nextUserId: string) => {
    setUserId(nextUserId);
    setActiveTab('home');
  };

  const handleLoginWithPin = async (email: string, pin: string) => {
    const payload = await apiRequest<BootstrapPayload>('/api/auth/login', userId, {
      method: 'POST',
      body: JSON.stringify({ email, pin }),
    });
    setData(payload);
    setUserId(payload.currentUser.id);
    setLang(payload.currentUser.preferredLang || 'en');
    setActiveTab('home');
  };

  const handleModeratePost = async (
    postId: string,
    action: 'pin' | 'unpin' | 'hide' | 'unhide' | 'delete',
    note?: string
  ) => {
    const next = await apiRequest(`/api/social/posts/${postId}/moderate`, userId, {
      method: 'PATCH',
      body: JSON.stringify({ action, note }),
    });
    setData(next);
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 lg:p-10">
        <div className="mx-auto max-w-6xl space-y-6 animate-pulse">
          <div className="h-12 w-64 rounded-xl bg-slate-200 dark:bg-slate-800" />
          <div className="h-48 w-full rounded-2xl bg-slate-200 dark:bg-slate-800" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="h-28 rounded-xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-28 rounded-xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-28 rounded-xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-28 rounded-xl bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
          <h1 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Unable to Load Society Workspace
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{error}</p>
          <button
            type="button"
            onClick={() => setUserId((prev) => prev)}
            className="mt-4 min-h-[44px] rounded-lg bg-teal-800 px-5 text-sm font-medium text-white"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      currentUser={data.currentUser}
      availableUsers={data.availableUsers}
      onSwitchUser={handleSwitchUser}
      onLoginWithPin={handleLoginWithPin}
      lang={lang}
      onChangeLang={setLang}
      darkMode={darkMode}
      onToggleDark={() => setDarkMode((d) => !d)}
      largeText={largeText}
      onQuickRaiseTicket={() => {
        setActiveTab('tickets');
        setCreateTicketOpen(true);
      }}
    >
      {activeTab === 'home' && (
        <HomeView
          data={data}
          lang={lang}
          onNavigate={setActiveTab}
          onQuickRaiseTicket={() => {
            setActiveTab('tickets');
            setCreateTicketOpen(true);
          }}
          onUploadSocialImage={(dataUrl) => uploadSocialImage(dataUrl, userId)}
          onCreateSocialPost={async (payload) => {
            const next = await apiRequest('/api/social/posts', userId, {
              method: 'POST',
              body: JSON.stringify(payload),
            });
            setData(next);
          }}
          onToggleLikePost={async (postId) => {
            const next = await apiRequest(`/api/social/posts/${postId}/like`, userId, {
              method: 'POST',
            });
            setData(next);
          }}
          onToggleSavePost={async (postId) => {
            const next = await apiRequest(`/api/social/posts/${postId}/save`, userId, {
              method: 'POST',
            });
            setData(next);
          }}
          onAddPostComment={async (postId, text) => {
            const next = await apiRequest(`/api/social/posts/${postId}/comment`, userId, {
              method: 'POST',
              body: JSON.stringify({ text }),
            });
            setData(next);
          }}
          onDeletePostComment={async (postId, commentId) => {
            const next = await apiRequest(
              `/api/social/posts/${postId}/comments/${commentId}`,
              userId,
              { method: 'DELETE' }
            );
            setData(next);
          }}
          onReportPost={async (postId, reason) => {
            const next = await apiRequest(`/api/social/posts/${postId}/report`, userId, {
              method: 'POST',
              body: JSON.stringify({ reason }),
            });
            setData(next);
          }}
          onModeratePost={handleModeratePost}
          onTriggerSos={async (payload) => {
            const next = await apiRequest('/api/sos', userId, {
              method: 'POST',
              body: JSON.stringify(payload),
            });
            setData(next);
          }}
          onUpdateSosStatus={async (sosId, status) => {
            const next = await apiRequest(`/api/sos/${sosId}`, userId, {
              method: 'PATCH',
              body: JSON.stringify({ status }),
            });
            setData(next);
          }}
        />
      )}

      {activeTab === 'tickets' && (
        <TicketsView
          data={data}
          createModalOpen={createTicketOpen}
          onSetCreateModalOpen={setCreateTicketOpen}
          onCreateTicket={async (payload) => {
            const next = await apiRequest('/api/tickets', userId, {
              method: 'POST',
              body: JSON.stringify(payload),
            });
            setData(next);
          }}
          onUpdateTicket={async (ticketId, payload) => {
            const next = await apiRequest(`/api/tickets/${ticketId}`, userId, {
              method: 'PATCH',
              body: JSON.stringify(payload),
            });
            setData(next);
          }}
          onDeleteTicket={async (ticketId) => {
            const next = await apiRequest(`/api/tickets/${ticketId}`, userId, {
              method: 'DELETE',
            });
            setData(next);
          }}
        />
      )}

      {activeTab === 'finance' && (
        <FinanceView
          data={data}
          onPayInvoice={async (invoiceId, paymentMethod, idempotencyKey) => {
            const next = await apiRequest(`/api/invoices/${invoiceId}/pay`, userId, {
              method: 'POST',
              body: JSON.stringify({ paymentMethod, idempotencyKey }),
            });
            setData(next);
          }}
          onDisputeInvoice={async (invoiceId, reason) => {
            const next = await apiRequest(`/api/invoices/${invoiceId}/dispute`, userId, {
              method: 'POST',
              body: JSON.stringify({ reason }),
            });
            setData(next);
          }}
          onGenerateBatch={async (payload) => {
            const next = await apiRequest('/api/invoices/generate-batch', userId, {
              method: 'POST',
              body: JSON.stringify(payload),
            });
            setData(next);
          }}
          onApproveExpense={async (expenseId) => {
            const next = await apiRequest(`/api/expenses/${expenseId}/approve`, userId, {
              method: 'POST',
            });
            setData(next);
          }}
          onCreateExpense={async (payload) => {
            const next = await apiRequest('/api/expenses', userId, {
              method: 'POST',
              body: JSON.stringify(payload),
            });
            setData(next);
          }}
          onPostJournal={async (payload) => {
            const next = await apiRequest('/api/ledger/journal', userId, {
              method: 'POST',
              body: JSON.stringify(payload),
            });
            setData(next);
          }}
        />
      )}

      {activeTab === 'services' && (
        <ServicesMarketplaceView
          data={data}
          onOptIn={async (campaignId, payload) => {
            const next = await apiRequest(`/api/campaigns/${campaignId}/opt-in`, userId, {
              method: 'POST',
              body: JSON.stringify(payload),
            });
            setData(next);
          }}
          onManageCampaign={async (campaignId, payload) => {
            const next = await apiRequest(`/api/campaigns/${campaignId}/manage`, userId, {
              method: 'PATCH',
              body: JSON.stringify(payload),
            });
            setData(next);
          }}
          onCreateCampaign={async (payload) => {
            const next = await apiRequest('/api/campaigns', userId, {
              method: 'POST',
              body: JSON.stringify(payload),
            });
            setData(next);
          }}
        />
      )}

      {activeTab === 'amenities' && (
        <AmenitiesEventsView
          data={data}
          onBookAmenity={async (payload) => {
            const next = await apiRequest('/api/amenities/book', userId, {
              method: 'POST',
              body: JSON.stringify(payload),
            });
            setData(next);
          }}
          onCancelBooking={async (bookingId) => {
            const next = await apiRequest(`/api/amenities/bookings/${bookingId}/cancel`, userId, {
              method: 'POST',
            });
            setData(next);
          }}
          onRsvpEvent={async (eventId, payload) => {
            const next = await apiRequest(`/api/events/${eventId}/rsvp`, userId, {
              method: 'POST',
              body: JSON.stringify(payload),
            });
            setData(next);
          }}
        />
      )}

      {activeTab === 'governance' && (
        <GovernanceView
          data={data}
          onCastVote={async (voteId, optionIds) => {
            const next = await apiRequest(`/api/votes/${voteId}/cast`, userId, {
              method: 'POST',
              body: JSON.stringify({ optionIds }),
            });
            setData(next);
          }}
          onCreateVote={async (payload) => {
            const next = await apiRequest('/api/votes', userId, {
              method: 'POST',
              body: JSON.stringify(payload),
            });
            setData(next);
          }}
          onUpdateResolution={async (meetingId, resId, status) => {
            const next = await apiRequest(`/api/meetings/${meetingId}/resolutions/${resId}`, userId, {
              method: 'PATCH',
              body: JSON.stringify({ status }),
            });
            setData(next);
          }}
        />
      )}

      {activeTab === 'operations' && (
        <OperationsView
          data={data}
          onAckNotice={async (noticeId) => {
            const next = await apiRequest(`/api/notices/${noticeId}/acknowledge`, userId, {
              method: 'POST',
            });
            setData(next);
          }}
          onPublishNotice={async (payload) => {
            const next = await apiRequest('/api/notices', userId, {
              method: 'POST',
              body: JSON.stringify(payload),
            });
            setData(next);
          }}
          onCreateVisitor={async (payload) => {
            const next = await apiRequest('/api/visitors', userId, {
              method: 'POST',
              body: JSON.stringify(payload),
            });
            setData(next);
          }}
          onRedeemVisitorPass={async (passCode) => {
            const next = await apiRequest('/api/visitors/redeem', userId, {
              method: 'POST',
              body: JSON.stringify({ passCode }),
            });
            setData(next);
          }}
          onDecideVisitor={async (visitorId, decision) => {
            const next = await apiRequest(`/api/visitors/${visitorId}/decision`, userId, {
              method: 'PATCH',
              body: JSON.stringify({ decision }),
            });
            setData(next);
          }}
          onUpdateVisitorStatus={async (visitorId, status) => {
            const next = await apiRequest(`/api/visitors/${visitorId}/status`, userId, {
              method: 'PATCH',
              body: JSON.stringify({ status }),
            });
            setData(next);
          }}
          onLogAssetService={async (assetId) => {
            const next = await apiRequest(`/api/assets/${assetId}/service`, userId, {
              method: 'POST',
            });
            setData(next);
          }}
          onRegisterHouseHelp={async (payload) => {
            const next = await apiRequest('/api/house-help', userId, {
              method: 'POST',
              body: JSON.stringify(payload),
            });
            setData(next);
          }}
          onHouseHelpAttendance={async (houseHelpId, direction) => {
            const next = await apiRequest(`/api/house-help/${houseHelpId}/attendance`, userId, {
              method: 'POST',
              body: JSON.stringify({ direction }),
            });
            setData(next);
          }}
          onVerifyHouseHelp={async (houseHelpId, backgroundCheck, idVerified) => {
            const next = await apiRequest(`/api/house-help/${houseHelpId}/verify`, userId, {
              method: 'PATCH',
              body: JSON.stringify({ backgroundCheck, idVerified }),
            });
            setData(next);
          }}
          onAssignHouseHelpFlat={async (houseHelpId, flatNumber) => {
            const next = await apiRequest(`/api/house-help/${houseHelpId}/assign`, userId, {
              method: 'POST',
              body: JSON.stringify({ flatNumber }),
            });
            setData(next);
          }}
          onReviewHouseHelp={async (houseHelpId, rating, comment) => {
            const next = await apiRequest(`/api/house-help/${houseHelpId}/review`, userId, {
              method: 'POST',
              body: JSON.stringify({ rating, comment }),
            });
            setData(next);
          }}
          onCreateParcel={async (payload) => {
            const next = await apiRequest('/api/parcels', userId, {
              method: 'POST',
              body: JSON.stringify(payload),
            });
            setData(next);
          }}
          onCollectParcel={async (parcelId, pickupOtp) => {
            const next = await apiRequest(`/api/parcels/${parcelId}/collect`, userId, {
              method: 'POST',
              body: JSON.stringify({ pickupOtp }),
            });
            setData(next);
          }}
          onGuardShiftAction={async (payload) => {
            const next = await apiRequest('/api/guard/shift', userId, {
              method: 'POST',
              body: JSON.stringify(payload),
            });
            setData(next);
          }}
          onSendParkingAlert={async (payload) => {
            const next = await apiRequest('/api/vehicles/alert', userId, {
              method: 'POST',
              body: JSON.stringify(payload),
            });
            setData(next);
          }}
        />
      )}

      {activeTab === 'profile' && (
        <FlatDirectoryProfileView
          data={data}
          lang={lang}
          onChangeLang={setLang}
          largeText={largeText}
          onToggleLargeText={() => setLargeText((l) => !l)}
          onUpdatePreferences={async (payload) => {
            const next = await apiRequest('/api/profile/preferences', userId, {
              method: 'PATCH',
              body: JSON.stringify(payload),
            });
            setData(next);
          }}
          onUpdateMyFlat={async (kind, payload) => {
            const next = await apiRequest('/api/flats/my/update', userId, {
              method: 'POST',
              body: JSON.stringify({ kind, payload }),
            });
            setData(next);
          }}
          onCreateSubAccount={async (payload) => {
            const next = await apiRequest('/api/secretary/accounts', userId, {
              method: 'POST',
              body: JSON.stringify(payload),
            });
            setData(next);
          }}
          onUpdateSubAccount={async (subUserId, payload) => {
            const next = await apiRequest(`/api/secretary/accounts/${subUserId}`, userId, {
              method: 'PATCH',
              body: JSON.stringify(payload),
            });
            setData(next);
          }}
          onDeleteSubAccount={async (subUserId) => {
            const next = await apiRequest(`/api/secretary/accounts/${subUserId}`, userId, {
              method: 'DELETE',
            });
            setData(next);
          }}
          onModeratePost={handleModeratePost}
        />
      )}
    </AppShell>
  );
}
