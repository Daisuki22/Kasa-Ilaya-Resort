import React from "react";
import { useAuth } from "@/lib/AuthContext";
import EventItemsManager from "@/components/admin/EventItemsManager";

export default function AdminBookings() {
  const { user } = useAuth();

  return (
    <div>
      <div className="w-full max-w-none px-2 pb-6 pt-6 sm:px-3 lg:px-4">
        <EventItemsManager user={user} />
      </div>
    </div>
  );
}
