"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "@/lib/supabase/hooks";
import { api } from "@/lib/supabase/api";
import { Bell } from "lucide-react";
import { Modal, Empty, Loading, useFeedback } from "./primitives";
import { Button } from "@/components/ui/button";
export function Notifications() {
  const [open, setOpen] = useState(false);
  const rows = useQuery(api.notifications.list);
  const mark = useMutation(api.notifications.markRead);
  const { run, feedback } = useFeedback();
  const unread = rows?.filter((r) => !r.read).length ?? 0;
  return (
    <Modal
      title="Notifications"
      open={open}
      onOpenChange={setOpen}
      trigger={
        <button
          className="notification-button p-2"
          aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        >
          <Bell size={19} />
          {unread > 0 && <span className="notification-count">{unread}</span>}
        </button>
      }
    >
      {feedback}
      {!rows ? (
        <Loading />
      ) : rows.length ? (
        <>
          <Button variant="ghost" onClick={() => run(() => mark({}))}>
            Mark all as read
          </Button>
          {rows.map((r) => (
            <div className="list-item" key={r._id}>
              <Link
                href={r.href}
                onClick={() => {
                  setOpen(false);
                  void run(() => mark({ id: r._id }));
                }}
              >
                <div className="row">
                  <strong>{r.title}</strong>
                  {!r.read && <span className="notification-dot" />}
                </div>
                <p>{r.body}</p>
                <p className="meta">
                  {new Date(r._creationTime).toLocaleDateString()}
                </p>
              </Link>
            </div>
          ))}
        </>
      ) : (
        <Empty
          title="You’re all caught up"
          description="Replies and encouragement from your circle will appear here."
        />
      )}
    </Modal>
  );
}
