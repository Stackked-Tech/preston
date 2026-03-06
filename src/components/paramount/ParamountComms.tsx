"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTheme } from "@/lib/theme";
import {
  useContacts,
  useMessages,
  useSendMessage,
  useBulkSend,
  useScheduledMessages,
  useBroadcastHistory,
  useMessageSearch,
  markContactAsRead,
} from "@/lib/paramountHooks";
import ConversationList from "./ConversationList";
import MessageThread from "./MessageThread";
import ContactModal from "./ContactModal";
import BulkMessageModal from "./BulkMessageModal";
import ContactsManager from "./ContactsManager";
import BroadcastHistory from "./BroadcastHistory";
import MessageSearch from "./MessageSearch";

type ViewMode = "messages" | "contacts" | "broadcasts";

export default function ParamountComms() {
  const { theme, toggleTheme } = useTheme();
  const {
    contacts,
    loading: contactsLoading,
    addContact,
    updateContact,
    deleteContact,
  } = useContacts();
  const [selectedContactId, setSelectedContactId] = useState<string | null>(
    null
  );
  const { messages, loading: messagesLoading } = useMessages(selectedContactId);
  const { sendMessage, sending } = useSendMessage();
  const {
    sendBulk,
    sending: bulkSending,
    progress: bulkProgress,
  } = useBulkSend();
  const {
    scheduled,
    scheduleMessage,
    cancelScheduled,
  } = useScheduledMessages(selectedContactId);
  const {
    broadcasts,
    loading: broadcastsLoading,
    fetchRecipients,
  } = useBroadcastHistory();
  const {
    results: searchResults,
    searching,
    search,
    clearResults,
  } = useMessageSearch();

  // View & modal state
  const [viewMode, setViewMode] = useState<ViewMode>("messages");
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<string | null>(null);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const selectedContact =
    contacts.find((c) => c.id === selectedContactId) || null;
  const modalContact = editingContact
    ? contacts.find((c) => c.id === editingContact) || null
    : null;

  // Mark as read when selecting a contact
  useEffect(() => {
    if (selectedContactId) {
      const contact = contacts.find((c) => c.id === selectedContactId);
      if (contact && contact.unread_count > 0) {
        markContactAsRead(selectedContactId);
      }
    }
  }, [selectedContactId, contacts]);

  // Keyboard shortcut: Cmd+K for search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false);
        clearResults();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [searchOpen, clearResults]);

  const handleSendMessage = useCallback(
    async (body: string) => {
      if (!selectedContactId) return;
      try {
        await sendMessage(selectedContactId, body);
      } catch {
        // Error already logged in hook
      }
    },
    [selectedContactId, sendMessage]
  );

  const handleScheduleMessage = useCallback(
    async (body: string, scheduledAt: string) => {
      if (!selectedContactId) return;
      await scheduleMessage(selectedContactId, body, scheduledAt);
    },
    [selectedContactId, scheduleMessage]
  );

  const handleSaveContact = useCallback(
    async (data: {
      name: string;
      phone_number: string;
      email: string;
      notes: string;
      tags: string[];
    }) => {
      if (editingContact) {
        await updateContact(editingContact, {
          name: data.name,
          phone_number: data.phone_number,
          email: data.email || null,
          notes: data.notes || null,
          tags: data.tags,
          is_active: true,
        });
      } else {
        const created = await addContact({
          name: data.name,
          phone_number: data.phone_number,
          email: data.email || null,
          notes: data.notes || null,
          tags: data.tags,
          is_active: true,
        });
        setSelectedContactId(created.id);
      }
    },
    [editingContact, addContact, updateContact]
  );

  const handleDeleteContact = useCallback(
    async (id: string) => {
      await deleteContact(id);
      if (selectedContactId === id) {
        setSelectedContactId(null);
      }
    },
    [deleteContact, selectedContactId]
  );

  const handleBulkSend = useCallback(
    async (contactIds: string[], body: string) => {
      await sendBulk(contactIds, body);
    },
    [sendBulk]
  );

  const handleSearchSelect = useCallback(
    (contactId: string) => {
      setSelectedContactId(contactId);
      setViewMode("messages");
    },
    []
  );

  // Total unread across all contacts
  const totalUnread = contacts.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  return (
    <div
      className="paramount h-screen flex flex-col"
      style={{ background: "var(--bg-primary)" }}
    >
      {/* Top Bar */}
      <header
        className="flex items-center justify-between px-5 py-2.5 border-b"
        style={{ borderColor: "var(--border-light)" }}
      >
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-xs no-underline"
            style={{ color: "var(--text-muted)" }}
          >
            &larr;
          </Link>
          <Image
            src="/pica-logo-bw.png"
            alt="Paramount Communications"
            width={32}
            height={32}
            className="object-contain"
            style={{ filter: theme === "dark" ? "invert(1)" : "none" }}
          />
          <div>
            <h1
              className="pc-heading text-sm font-semibold tracking-wide m-0"
              style={{ color: "var(--text-primary)" }}
            >
              Paramount Communications
            </h1>
            <p
              className="text-[10px] tracking-[1.5px] uppercase m-0"
              style={{ color: "var(--text-muted)" }}
            >
              SMS Portal
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Search */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-colors"
            style={{
              borderColor: "var(--border-light)",
              color: "var(--text-muted)",
            }}
            title="Search messages (Cmd+K)"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            Search
          </button>

          {/* Tab Toggle */}
          <div
            className="flex rounded-lg border overflow-hidden"
            style={{ borderColor: "var(--border-light)" }}
          >
            {(["messages", "contacts", "broadcasts"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className="px-3 py-1 text-xs font-medium tracking-wide uppercase transition-colors relative"
                style={{
                  background:
                    viewMode === mode
                      ? "rgba(242, 101, 57, 0.15)"
                      : "transparent",
                  color: viewMode === mode ? "#f26539" : "var(--text-muted)",
                }}
              >
                {mode}
                {mode === "messages" && totalUnread > 0 && viewMode !== "messages" && (
                  <span
                    className="absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full flex items-center justify-center text-[8px] font-bold"
                    style={{ background: "#f26539", color: "#fff" }}
                  >
                    {totalUnread > 9 ? "9+" : totalUnread}
                  </span>
                )}
              </button>
            ))}
          </div>

          <button
            onClick={toggleTheme}
            className="border px-2.5 py-1 rounded-md text-xs tracking-[1px] uppercase transition-all"
            style={{
              borderColor: "var(--border-color)",
              color: "#f26539",
            }}
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {viewMode === "messages" ? (
          <>
            <ConversationList
              contacts={contacts}
              selectedId={selectedContactId}
              onSelect={setSelectedContactId}
              onNewContact={() => {
                setEditingContact(null);
                setContactModalOpen(true);
              }}
              onBulkMessage={() => setBulkModalOpen(true)}
              loading={contactsLoading}
            />
            <MessageThread
              contact={selectedContact}
              messages={messages}
              loading={messagesLoading}
              sending={sending}
              onSend={handleSendMessage}
              onEditContact={() => {
                if (selectedContactId) {
                  setEditingContact(selectedContactId);
                  setContactModalOpen(true);
                }
              }}
              scheduled={scheduled}
              onSchedule={handleScheduleMessage}
              onCancelScheduled={cancelScheduled}
            />
          </>
        ) : viewMode === "contacts" ? (
          <ContactsManager
            contacts={contacts}
            loading={contactsLoading}
            onEdit={(id) => {
              setEditingContact(id);
              setContactModalOpen(true);
            }}
            onAdd={() => {
              setEditingContact(null);
              setContactModalOpen(true);
            }}
            onDelete={handleDeleteContact}
            onMessage={(id) => {
              setSelectedContactId(id);
              setViewMode("messages");
            }}
          />
        ) : (
          <BroadcastHistory
            broadcasts={broadcasts}
            loading={broadcastsLoading}
            onFetchRecipients={fetchRecipients}
          />
        )}
      </div>

      {/* Modals */}
      <ContactModal
        contact={modalContact}
        open={contactModalOpen}
        onClose={() => {
          setContactModalOpen(false);
          setEditingContact(null);
        }}
        onSave={handleSaveContact}
        onDelete={editingContact ? handleDeleteContact : undefined}
      />

      <BulkMessageModal
        contacts={contacts}
        open={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        onSend={handleBulkSend}
        sending={bulkSending}
        progress={bulkProgress}
      />

      <MessageSearch
        open={searchOpen}
        onClose={() => {
          setSearchOpen(false);
          clearResults();
        }}
        results={searchResults}
        searching={searching}
        onSearch={search}
        onSelectContact={handleSearchSelect}
      />
    </div>
  );
}
