import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Archive, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { baseClient } from "@/api/baseClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const roleBadgeClass = {
  super_admin: "bg-primary/10 text-primary border-primary/30",
  admin: "bg-accent/20 text-accent-foreground border-accent/30",
  guest: "bg-muted text-muted-foreground border-border",
};

const roleLabel = {
  super_admin: "Super Admin",
  admin: "Admin",
  guest: "Guest",
};

export default function AdminUserPermissions() {
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [savingKey, setSavingKey] = useState("");

  useEffect(() => {
    baseClient.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-user-permissions"],
    queryFn: () => baseClient.entities.User.list("full_name", 1000),
  });

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((user) => {
      if (Boolean(user.disabled)) {
        return false;
      }

      if (roleFilter !== "all" && user.role !== roleFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [user.full_name, user.email, user.role, user.phone]
        .map((value) => String(value || "").toLowerCase())
        .some((value) => value.includes(query));
    }
    );
  }, [roleFilter, search, users]);

  const isSelf = (userId) => currentUser?.id && userId === currentUser.id;

  const updateRole = async (targetUser, nextRole) => {
    if (!targetUser || targetUser.role === nextRole) {
      return;
    }

    if (isSelf(targetUser.id) && nextRole !== "super_admin") {
      toast.error("You cannot downgrade your own account.");
      return;
    }

    const saveId = `role-${targetUser.id}`;
    setSavingKey(saveId);

    try {
      await baseClient.entities.User.update(targetUser.id, {
        role: nextRole,
        app_role: nextRole,
      });

      await baseClient.entities.ActivityLog.create({
        user_email: currentUser?.email,
        user_name: currentUser?.full_name,
        action: "Updated User Role",
        entity_type: "User",
        entity_id: targetUser.id,
        details: `Changed role of ${targetUser.email} from ${targetUser.role} to ${nextRole}`,
      });

      toast.success("User role updated.");
      queryClient.invalidateQueries({ queryKey: ["admin-user-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-activity-logs"] });
    } catch (error) {
      toast.error(error?.message || "Unable to update user role.");
    } finally {
      setSavingKey("");
    }
  };

  const updateDisabledState = async (targetUser, nextDisabled) => {
    if (!targetUser || Boolean(targetUser.disabled) === nextDisabled) {
      return;
    }

    if (isSelf(targetUser.id) && nextDisabled) {
      toast.error("You cannot disable your own account.");
      return;
    }

    const saveId = `status-${targetUser.id}`;
    setSavingKey(saveId);

    try {
      await baseClient.entities.User.update(targetUser.id, {
        disabled: nextDisabled,
      });

      await baseClient.entities.ActivityLog.create({
        user_email: currentUser?.email,
        user_name: currentUser?.full_name,
        action: nextDisabled ? "Disabled User Account" : "Enabled User Account",
        entity_type: "User",
        entity_id: targetUser.id,
        details: `${nextDisabled ? "Disabled" : "Enabled"} account for ${targetUser.email}`,
      });

      toast.success(nextDisabled ? "User disabled." : "User enabled.");
      queryClient.invalidateQueries({ queryKey: ["admin-user-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-activity-logs"] });
    } catch (error) {
      toast.error(error?.message || "Unable to update user status.");
    } finally {
      setSavingKey("");
    }
  };

  return (
    <div className="w-full max-w-none space-y-6 px-2 py-6 sm:px-3 lg:px-4">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">Manage User Permissions</h1>
        <p className="mt-1 text-muted-foreground">
          Control active user roles and account access. Archived accounts are restored from Archive.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-md flex-1 min-w-[280px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, email, role, or phone..."
            className="pl-10"
          />
        </div>

        <div className="w-full max-w-xs sm:w-auto sm:min-w-[180px]">
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="guest">Guests</SelectItem>
              <SelectItem value="admin">Admins</SelectItem>
              <SelectItem value="super_admin">Super Admins</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Account Status</TableHead>
                  <TableHead className="text-right">Archive</TableHead>
                  <TableHead>Registered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      No users found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((targetUser) => {
                    const roleSaving = savingKey === `role-${targetUser.id}`;
                    const statusSaving = savingKey === `status-${targetUser.id}`;

                    return (
                      <TableRow key={targetUser.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm text-foreground">{targetUser.full_name || "Unnamed"}</p>
                            <p className="text-xs font-mono text-muted-foreground">{targetUser.id}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{targetUser.email}</p>
                            <p className="text-xs text-muted-foreground">{targetUser.phone || "No phone"}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={roleBadgeClass[targetUser.role] || roleBadgeClass.guest}>
                              {roleLabel[targetUser.role] || targetUser.role}
                            </Badge>
                            <Select
                              value={targetUser.role || "guest"}
                              onValueChange={(value) => updateRole(targetUser, value)}
                              disabled={roleSaving}
                            >
                              <SelectTrigger className="w-[150px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="guest">Guest</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="super_admin">Super Admin</SelectItem>
                              </SelectContent>
                            </Select>
                            {roleSaving ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                              Active
                            </Badge>
                            {statusSaving ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => updateDisabledState(targetUser, true)}
                            disabled={statusSaving || isSelf(targetUser.id)}
                          >
                            <Archive className="h-4 w-4" />
                            Archive
                          </Button>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {targetUser.created_date ? format(new Date(targetUser.created_date), "MMM d, yyyy") : "Unknown"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
