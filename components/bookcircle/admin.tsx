"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery, useMutation, useAction } from "@/lib/supabase/hooks";
import { api } from "@/lib/supabase/api";
import type { Id } from "@/lib/supabase/contracts";
import { Button } from "@/components/ui/button";
import { Plus, Copy, ShieldCheck } from "lucide-react";
import {
  ActionForm,
  Field,
  Modal,
  value,
  number,
  PageHeading,
  Loading,
  Empty,
  useFeedback,
} from "./primitives";
import { useMember } from "./shell";
import { AddBook } from "./reading";
import { CreateChallenge } from "./challenges";
import { CreateMeeting, CreateRound } from "./events";
export function AdminPage() {
  const { membership } = useMember();
  return membership.role === "admin" ? (
    <AdminContent />
  ) : (
    <Empty
      title="Administrator access required"
      description="These tools are available to your club administrators."
    />
  );
}
function AdminContent() {
  const summary = useQuery(api.admin.overview);
  const members = useQuery(api.admin.members);
  const invitations = useQuery(api.admin.invitations);
  const reports = useQuery(api.admin.reports);
  const categories = useQuery(api.forum.categories);
  const generate = useAction(api.admin.generateInvitation);
  const revoke = useMutation(api.admin.revokeInvitation);
  const status = useMutation(api.admin.setMemberStatus);
  const resolve = useMutation(api.admin.resolveReport);
  const pair = useMutation(api.club.pairMembers);
  const prompt = useMutation(api.admin.setWeeklyPrompt);
  const category = useMutation(api.admin.saveCategory);
  const [code, setCode] = useState("");
  const { run, busy, feedback } = useFeedback();
  if (!summary || !members || !invitations || !reports) return <Loading />;
  return (
    <>
      <PageHeading
        eyebrow="CARE FOR YOUR CIRCLE"
        title="Club administration"
        description="A few thoughtful tools to help your community thrive."
        action={<ShieldCheck className="text-primary" />}
      />
      <div className="stat-grid mb-6">
        {[
          ["Active members", summary.counts?.members ?? 0],
          ["Reading sessions", summary.counts?.sessions ?? 0],
          ["Insights shared", summary.counts?.insights ?? 0],
        ].map(([label, count]) => (
          <div key={label} className="stat-card">
            <p className="stat-top">{label}</p>
            <p className="stat-number">{count}</p>
          </div>
        ))}
      </div>
      <div className="pill-row mb-6">
        <AddBook />
        <CreateChallenge />
        <CreateMeeting />
        <CreateRound />
      </div>
      {feedback}
      <div className="grid-main">
        <div className="stack">
          <section className="panel">
            <div className="section-head">
              <h2>Invitation management</h2>
              <Modal
                title="Invite someone to the circle"
                trigger={
                  <Button variant="outline">
                    <Plus />
                    Create invite
                  </Button>
                }
              >
                <ActionForm
                  label="Generate invitation"
                  onSubmit={async (d) => {
                    const result = await generate({
                      expiresInDays: number(d, "days"),
                      maxUses: number(d, "uses"),
                    });
                    setCode(result.code);
                  }}
                >
                  <div className="field-row">
                    <Field label="Expires in days">
                      <input
                        name="days"
                        type="number"
                        min={1}
                        max={90}
                        defaultValue={7}
                        required
                      />
                    </Field>
                    <Field label="Maximum uses">
                      <input
                        name="uses"
                        type="number"
                        min={1}
                        max={100}
                        defaultValue={1}
                        required
                      />
                    </Field>
                  </div>
                </ActionForm>
                {code && (
                  <div className="spaced">
                    <p className="meta">
                      Copy this code now. Only its secure hash is stored.
                    </p>
                    <p className="prose break-all my-3">{code}</p>
                    <div className="pill-row">
                      <Button
                        variant="outline"
                        onClick={() =>
                          run(() => navigator.clipboard.writeText(code))
                        }
                      >
                        <Copy />
                        Copy code
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() =>
                          run(() =>
                            navigator.clipboard.writeText(
                              `${window.location.origin}/?invite=${encodeURIComponent(code)}`,
                            ),
                          )
                        }
                      >
                        Copy invite link
                      </Button>
                    </div>
                    {feedback}
                  </div>
                )}
              </Modal>
            </div>
            {invitations.length ? (
              invitations.map((i) => (
                <div className="list-item row between" key={i._id}>
                  <div>
                    <strong className="text-sm">
                      {i.revoked
                        ? "Revoked"
                        : i.uses >= i.maxUses
                          ? "Redeemed"
                          : "Invitation"}
                    </strong>
                    <p className="meta">
                      {i.uses} / {i.maxUses} uses · Expires{" "}
                      {new Date(i.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  {!i.revoked && i.uses < i.maxUses && (
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => run(() => revoke({ id: i._id }))}
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              ))
            ) : (
              <Empty
                title="A circle starts with an invitation"
                description="Generate a secure, single-use code for your next member."
              />
            )}
          </section>
          <section className="panel">
            <h2 className="mb-4">Members</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Access</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.membership._id}>
                      <td>
                        <strong>{m.name}</strong>
                        <div className="meta">{m.email}</div>
                        <div className="meta">
                          Last active{" "}
                          {new Date(m.lastActiveAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td>{m.membership.role}</td>
                      <td>{m.membership.status}</td>
                      <td>
                        {m.membership.role !== "admin" && (
                          <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              run(() =>
                                status({
                                  id: m.membership._id,
                                  status:
                                    m.membership.status === "active"
                                      ? "inactive"
                                      : "active",
                                }),
                              )
                            }
                          >
                            {m.membership.status === "active"
                              ? "Deactivate"
                              : "Activate"}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel">
            <h2 className="mb-4">Reported discussions</h2>
            {reports.length ? (
              reports.map((r) => (
                <div className="list-item" key={r._id}>
                  <p>{r.reason}</p>
                  <div className="pill-row mt-3">
                    <Button variant="outline" asChild>
                      <Link href={`/forum/${r.questionId}`}>
                        Review discussion
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => run(() => resolve({ id: r._id }))}
                    >
                      Mark resolved
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="muted text-sm">No unresolved reports.</p>
            )}
          </section>
        </div>
        <aside className="stack">
          <section className="panel">
            <h2 className="mb-4">Accountability partners</h2>
            <ActionForm
              label="Pair members"
              onSubmit={(d) =>
                pair({
                  firstId: value(d, "first") as Id<"profiles">,
                  secondId: value(d, "second") as Id<"profiles">,
                })
              }
            >
              {["first", "second"].map((key, i) => (
                <Field key={key} label={`Member ${i + 1}`}>
                  <select name={key} required defaultValue="">
                    <option value="">Choose a member</option>
                    {members
                      .filter((m) => m.membership.status === "active")
                      .map((m) => (
                        <option
                          key={m.membership._id}
                          value={m.membership.profileId}
                        >
                          {m.name}
                        </option>
                      ))}
                  </select>
                </Field>
              ))}
              <p className="meta">
                Assigning a new pair replaces their previous pairings.
              </p>
            </ActionForm>
          </section>
          <section className="panel">
            <h2 className="mb-4">Weekly discussion</h2>
            <ActionForm
              label="Publish prompt"
              onSubmit={(d) => prompt({ prompt: value(d, "prompt") })}
            >
              <Field label="A question for the circle">
                <textarea
                  name="prompt"
                  required
                  defaultValue={summary.club.weeklyPrompt}
                  maxLength={2000}
                />
              </Field>
            </ActionForm>
          </section>
          <section className="panel">
            <h2 className="mb-4">Forum categories</h2>
            {categories?.map((c) => (
              <div key={c._id} className="list-item row between">
                <span className="text-sm">{c.name}</span>
                <button
                  className="text-button"
                  onClick={() =>
                    run(() =>
                      category({ id: c._id, name: c.name, active: !c.active }),
                    )
                  }
                >
                  {c.active ? "Disable" : "Enable"}
                </button>
              </div>
            ))}
            <div className="spaced">
              <ActionForm
                label="Add category"
                onSubmit={(d) =>
                  category({ name: value(d, "name"), active: true })
                }
              >
                <Field label="Category name">
                  <input name="name" required maxLength={80} />
                </Field>
              </ActionForm>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
