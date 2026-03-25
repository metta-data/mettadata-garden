import { useState, useEffect } from "react";
import type { ResolvedUser } from "@mettadata/content-model";

const ROLES = ["viewer", "steward", "admin"] as const;

interface UserRow {
  id: string;
  email: string;
  name: string;
  image: string | null;
  role: string;
  gardens: string;
  created_at: string;
  last_login: string | null;
}

interface GardenOption {
  name: string;
  display_name: string;
  icon: string;
}

export function UserManager() {
  const [currentUser, setCurrentUser] = useState<ResolvedUser | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [gardens, setGardens] = useState<GardenOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/me").then((r) => r.json()),
      fetch("/api/admin/users").then((r) => r.json()),
      fetch("/api/admin/gardens").then((r) => r.json()),
    ])
      .then(([me, userData, gardensData]) => {
        setCurrentUser(me.user);
        if (userData.users) setUsers(userData.users);
        if (userData.error) setMessage(userData.error);
        setGardens(
          (gardensData.gardens || []).map((g: any) => ({
            name: g.name,
            display_name: g.display_name,
            icon: g.icon || "",
          }))
        );
      })
      .catch((err) => setMessage(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center py-12 text-[var(--color-text-muted)]">Loading...</div>;
  }

  if (!currentUser || currentUser.role !== "admin") {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--color-text-secondary)]">Admin access required.</p>
      </div>
    );
  }

  async function updateUser(id: string, role: string, userGardens: string[]) {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, role, gardens: userGardens }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === id ? { ...u, role, gardens: JSON.stringify(userGardens) } : u
          )
        );
        setMessage("Updated");
        setTimeout(() => setMessage(""), 2000);
      }
    } catch (err) {
      setMessage("Failed to update");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Users</h1>
        {message && (
          <span className="text-sm text-green-500">{message}</span>
        )}
      </div>

      <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg-secondary)]">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-[var(--color-text-secondary)]">User</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--color-text-secondary)]">Role</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--color-text-secondary)]">Gardens</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--color-text-secondary)]">Last Login</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <UserRowComponent
                key={user.id}
                user={user}
                isCurrentUser={user.email === currentUser.email}
                gardens={gardens}
                onUpdate={updateUser}
              />
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <p className="text-center py-8 text-[var(--color-text-muted)]">
          No users yet. Users appear here after signing in with Google.
        </p>
      )}
    </div>
  );
}

function UserRowComponent({
  user,
  isCurrentUser,
  gardens,
  onUpdate,
}: {
  user: UserRow;
  isCurrentUser: boolean;
  gardens: GardenOption[];
  onUpdate: (id: string, role: string, gardens: string[]) => void;
}) {
  const [role, setRole] = useState(user.role);
  const [userGardens, setUserGardens] = useState<string[]>(
    JSON.parse(user.gardens || "[]")
  );

  function handleRoleChange(newRole: string) {
    setRole(newRole);
    onUpdate(user.id, newRole, userGardens);
  }

  function toggleGarden(g: string) {
    const next = userGardens.includes(g)
      ? userGardens.filter((x) => x !== g)
      : [...userGardens, g];
    setUserGardens(next);
    onUpdate(user.id, role, next);
  }

  return (
    <tr className="border-t border-[var(--color-border)]">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {user.image ? (
            <img src={user.image} alt="" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-accent)] text-xs text-white font-medium">
              {user.name.charAt(0).toUpperCase()}
            </span>
          )}
          <div>
            <div className="font-medium text-[var(--color-text)]">
              {user.name}
              {isCurrentUser && (
                <span className="ml-1 text-xs text-[var(--color-text-muted)]">(you)</span>
              )}
            </div>
            <div className="text-xs text-[var(--color-text-muted)]">{user.email}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <select
          value={role}
          onChange={(e) => handleRoleChange(e.target.value)}
          disabled={isCurrentUser}
          className={`rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs
            ${isCurrentUser ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">
        {role === "steward" ? (
          <div className="flex flex-wrap gap-1">
            {gardens.map((g) => (
              <button
                key={g.name}
                onClick={() => toggleGarden(g.name)}
                className={`rounded px-2 py-0.5 text-xs transition-colors ${
                  userGardens.includes(g.name)
                    ? "bg-[var(--color-accent)] text-white"
                    : "bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]"
                }`}
              >
                {g.icon ? `${g.icon} ` : ""}{g.display_name}
              </button>
            ))}
          </div>
        ) : role === "admin" ? (
          <span className="text-xs text-[var(--color-text-muted)]">All gardens</span>
        ) : (
          <span className="text-xs text-[var(--color-text-muted)]">None</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
        {user.last_login
          ? new Date(user.last_login + "Z").toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })
          : "Never"}
      </td>
    </tr>
  );
}
