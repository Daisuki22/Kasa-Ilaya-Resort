import React, { useEffect, useMemo, useState } from "react";
import { LayoutTemplate, Waves, Type, BookOpen, FileText, Images, ImageIcon } from "lucide-react";
import SystemSettingsManager from "@/components/admin/SystemSettingsManager";
import ResortRulesManager from "@/components/admin/ResortRulesManager";
import { useAuth } from "@/lib/AuthContext";
import { isSuperAdmin } from "@/lib/adminAccess";

const SETTINGS_TABS = [
  {
    id: "homepage",
    label: "Homepage Content",
    icon: LayoutTemplate,
    desc: "Edit the website logo, hero image, hero text, and site name.",
    superAdminOnly: true,
  },
  {
    id: "amenities",
    label: "Amenities Section",
    icon: Waves,
    desc: "Customize the amenities section label, title, and each amenity card.",
    superAdminOnly: true,
  },
  {
    id: "text-style",
    label: "Text Style",
    icon: Type,
    desc: "Choose the body and heading font styles used across the website.",
    superAdminOnly: true,
  },
  {
    id: "resort-rules",
    label: "Resort Rules",
    icon: BookOpen,
    desc: "Manage the resort rules visible to guests on the homepage.",
    superAdminOnly: true,
  },
  {
    id: "terms-conditions",
    label: "Terms & Conditions",
    icon: FileText,
    desc: "Edit the guest-facing terms and conditions shown during booking and in the website footer.",
    superAdminOnly: true,
  },
  {
    id: "resort-gallery",
    label: "Resort Gallery",
    icon: Images,
    desc: "Manage the slider photos shown to guests on the home page. Super admins only.",
    superAdminOnly: true,
  },
  {
    id: "packages-banner",
    label: "Page Banners",
    icon: ImageIcon,
    desc: "Manage the banner photos shown on guest pages except the homepage. Super admins only.",
    superAdminOnly: true,
  },
];

export default function AdminSystemSettings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("tab") || "homepage";
  });
  const superAdminUser = isSuperAdmin(user);
  const visibleTabs = useMemo(
    () => SETTINGS_TABS.filter((tab) => !tab.superAdminOnly || superAdminUser),
    [superAdminUser]
  );
  const activeTabInfo = visibleTabs.find((t) => t.id === activeTab) || visibleTabs[0];

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.id === activeTab) && visibleTabs[0]) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [activeTab, visibleTabs]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", activeTabInfo?.id || "homepage");
    window.history.replaceState({}, "", url);
  }, [activeTabInfo?.id]);

  return (
    <div className="w-full max-w-none space-y-6 px-2 py-6 sm:px-3 lg:px-4">
      {/* Page header */}
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">System Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage website branding, homepage content, resort gallery images, amenities, resort rules, and legal text.
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-4">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Active tab description */}
      {activeTabInfo && (
        <p className="text-sm text-muted-foreground -mt-2">{activeTabInfo.desc}</p>
      )}

      {/* Keep SystemSettingsManager always mounted (hidden via CSS) to preserve unsaved state */}
      <div className={activeTab === "resort-rules" ? "hidden" : undefined}>
        <SystemSettingsManager
          section={activeTab !== "resort-rules" ? activeTab : "homepage"}
        />
      </div>

      {activeTab === "resort-rules" && <ResortRulesManager user={user} />}
    </div>
  );
}
