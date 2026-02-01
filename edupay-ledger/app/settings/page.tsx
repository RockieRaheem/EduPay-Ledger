"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFirebaseSettings } from "@/hooks/useFirebaseData";
import { Card, Button, Badge, Input, Modal, Table } from "@/components/ui";

// ============================================================================
// TYPES
// ============================================================================

type TabType =
  | "overview"
  | "users"
  | "integrations"
  | "notifications"
  | "logs"
  | "appearance";

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function LoadingState() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-48"></div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
        ))}
      </div>
      <div className="h-64 bg-gray-200 rounded-lg"></div>
    </div>
  );
}

function StatusIndicator({
  status,
}: {
  status:
    | "connected"
    | "disconnected"
    | "error"
    | "syncing"
    | "ok"
    | "warning"
    | "operational"
    | "degraded"
    | "down";
}) {
  const config: Record<string, { color: string; label: string }> = {
    connected: { color: "bg-green-500", label: "Connected" },
    disconnected: { color: "bg-gray-400", label: "Disconnected" },
    error: { color: "bg-red-500", label: "Error" },
    syncing: { color: "bg-blue-500 animate-pulse", label: "Syncing" },
    ok: { color: "bg-green-500", label: "OK" },
    warning: { color: "bg-yellow-500", label: "Warning" },
    operational: { color: "bg-green-500", label: "Operational" },
    degraded: { color: "bg-yellow-500", label: "Degraded" },
    down: { color: "bg-red-500", label: "Down" },
  };
  const { color, label } = config[status] || config.disconnected;

  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${color}`}></span>
      <span className="text-sm text-gray-600">{label}</span>
    </div>
  );
}

function QuickSettingCard({
  icon,
  title,
  description,
  status,
  actionLabel,
  onAction,
  href,
  badge,
}: {
  icon: string;
  title: string;
  description: string;
  status?: string;
  actionLabel?: string;
  onAction?: () => void;
  href?: string;
  badge?: { label: string; variant: "success" | "warning" | "danger" | "info" };
}) {
  const content = (
    <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-blue-50 rounded-lg">
          <span className="material-symbols-outlined text-blue-600">
            {icon}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900">{title}</h3>
            {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
          </div>
          <p className="text-sm text-gray-500 line-clamp-2">{description}</p>
          {status && <p className="text-xs text-gray-400 mt-2">{status}</p>}
        </div>
        {actionLabel && (
          <Button size="sm" variant="outline" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
        <span className="material-symbols-outlined text-gray-400">
          chevron_right
        </span>
      </div>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return <div onClick={onAction}>{content}</div>;
}

function SystemStatusCard({
  systemStatus,
  lastBackup,
}: {
  systemStatus: any;
  lastBackup?: Date;
}) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">System Status</h3>
        <StatusIndicator status={systemStatus.overall} />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-orange-500">
              database
            </span>
            <span className="font-medium">Firebase Database</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              {systemStatus.firebase.latency}ms latency
            </span>
            <StatusIndicator status={systemStatus.firebase.status} />
          </div>
        </div>

        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-blue-500">
              rocket_launch
            </span>
            <span className="font-medium">Stellar Blockchain</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              {systemStatus.stellar.network}
            </span>
            <StatusIndicator status={systemStatus.stellar.status} />
          </div>
        </div>

        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-green-500">
              sms
            </span>
            <span className="font-medium">SMS Gateway</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              Balance: UGX {systemStatus.sms.balance?.toLocaleString()}
            </span>
            <StatusIndicator status={systemStatus.sms.status} />
          </div>
        </div>

        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-purple-500">
              backup
            </span>
            <span className="font-medium">Backup System</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              Last:{" "}
              {lastBackup ? new Date(lastBackup).toLocaleString() : "Never"}
            </span>
            <StatusIndicator status={systemStatus.backup.status} />
          </div>
        </div>
      </div>
    </Card>
  );
}

// ============================================================================
// TAB CONTENT COMPONENTS
// ============================================================================

function OverviewTab({ settings, actions }: { settings: any; actions: any }) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    await actions.syncPaymentGateways();
    setIsSyncing(false);
  };

  const handleBackup = async () => {
    setIsBackingUp(true);
    await actions.createBackup();
    setIsBackingUp(false);
  };

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="flex items-center gap-3 mb-3">
            <span className="material-symbols-outlined">school</span>
            <span className="font-medium">School</span>
          </div>
          <h3 className="text-xl font-bold truncate">
            {settings.schoolInfo.name}
          </h3>
          <p className="text-blue-100 text-sm mt-1">
            {settings.schoolInfo.district} District
          </p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center gap-3 mb-3">
            <span className="material-symbols-outlined">calendar_month</span>
            <span className="font-medium">Current Term</span>
          </div>
          <h3 className="text-xl font-bold">{settings.currentTerm.name}</h3>
          <p className="text-green-100 text-sm mt-1">
            {settings.classes.length} classes configured
          </p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="flex items-center gap-3 mb-3">
            <span className="material-symbols-outlined">group</span>
            <span className="font-medium">Users</span>
          </div>
          <h3 className="text-xl font-bold">{settings.users.length}</h3>
          <p className="text-purple-100 text-sm mt-1">
            {settings.users.filter((u: any) => u.isActive).length} active
          </p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <div className="flex items-center gap-3 mb-3">
            <span className="material-symbols-outlined">receipt_long</span>
            <span className="font-medium">Fee Templates</span>
          </div>
          <h3 className="text-xl font-bold">{settings.feeTemplates.length}</h3>
          <p className="text-orange-100 text-sm mt-1">
            {settings.feeTemplates.filter((f: any) => f.isActive).length} active
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Status */}
        <SystemStatusCard
          systemStatus={settings.systemStatus}
          lastBackup={settings.backupConfig.lastBackupTime}
        />

        {/* Quick Settings */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Quick Settings</h3>
          <div className="space-y-3">
            <QuickSettingCard
              icon="domain"
              title="School Setup"
              description="Configure school information and academic structure"
              href="/settings/onboarding"
              badge={{ label: "Complete", variant: "success" }}
            />
            <QuickSettingCard
              icon="group"
              title="User Management"
              description="Manage staff accounts and permissions"
              status={`${settings.users.filter((u: any) => u.isActive).length} active users`}
              actionLabel="Manage"
              onAction={() => actions.setActiveTab("users")}
            />
            <QuickSettingCard
              icon="sync"
              title="Sync Payment Gateways"
              description="Synchronize with MTN MoMo, Airtel Money"
              status={`Last sync: ${settings.paymentGateways[0]?.lastSync ? new Date(settings.paymentGateways[0].lastSync).toLocaleTimeString() : "Never"}`}
              actionLabel={isSyncing ? "Syncing..." : "Sync Now"}
              onAction={handleSync}
            />
            <QuickSettingCard
              icon="backup"
              title="Backup Data"
              description="Create a full system backup"
              status={`Last backup: ${settings.backupConfig.lastBackupTime ? new Date(settings.backupConfig.lastBackupTime).toLocaleString() : "Never"}`}
              actionLabel={isBackingUp ? "Backing up..." : "Backup Now"}
              onAction={handleBackup}
            />
          </div>
        </Card>
      </div>

      {/* Recent Activity / System Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Recent System Activity</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => actions.setActiveTab("logs")}
            >
              View All
            </Button>
          </div>
          <div className="space-y-3">
            {settings.systemLogs.slice(0, 5).map((log: any) => (
              <div
                key={log.id}
                className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
              >
                <span
                  className={`material-symbols-outlined text-sm ${
                    log.level === "error"
                      ? "text-red-500"
                      : log.level === "warning"
                        ? "text-yellow-500"
                        : "text-blue-500"
                  }`}
                >
                  {log.level === "error"
                    ? "error"
                    : log.level === "warning"
                      ? "warning"
                      : "info"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {log.message}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{log.details}</p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">System Information</h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Version</p>
              <p className="font-medium">eBursar v2.1.0</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Environment</p>
              <p className="font-medium">Production</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Database</p>
              <p className="font-medium">Firebase Firestore</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Blockchain</p>
              <p className="font-medium">
                Stellar {settings.stellarConfig.network}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Storage Used</p>
              <p className="font-medium">2.4 GB / 10 GB</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Last Updated</p>
              <p className="font-medium">January 26, 2026</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function UsersTab({ settings, actions }: { settings: any; actions: any }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    role: "viewer" as any,
    isActive: true,
    permissions: [] as string[],
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleEditUser = (user: any) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      permissions: user.permissions,
    });
    setShowEditModal(true);
  };

  const handleSaveUser = async () => {
    setIsSaving(true);
    if (selectedUser) {
      await actions.updateUser(selectedUser.id, formData);
    } else {
      await actions.addUser(formData);
    }
    setIsSaving(false);
    setShowAddModal(false);
    setShowEditModal(false);
    setFormData({
      name: "",
      email: "",
      phone: "",
      role: "viewer",
      isActive: true,
      permissions: [],
    });
    setSelectedUser(null);
  };

  const handleDeleteUser = async (id: string) => {
    if (confirm("Are you sure you want to delete this user?")) {
      await actions.deleteUser(id);
    }
  };

  const roleConfig = actions.getRoleConfig;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">User Management</h2>
          <p className="text-gray-500">
            Manage staff accounts and access permissions
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <span className="material-symbols-outlined mr-2">person_add</span>
          Add User
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search users..."
              value={actions.searchQuery}
              onChange={(e) => actions.setSearchQuery(e.target.value)}
              icon={<span className="material-symbols-outlined">search</span>}
            />
          </div>
          <select
            value={actions.userRoleFilter}
            onChange={(e) => actions.setUserRoleFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Roles</option>
            <option value="admin">Administrator</option>
            <option value="bursar">Bursar</option>
            <option value="registrar">Registrar</option>
            <option value="teacher">Teacher</option>
            <option value="viewer">Viewer</option>
          </select>
        </div>
      </Card>

      {/* Users Table */}
      <Card className="overflow-hidden">
        <Table
          columns={[
            {
              header: "User",
              accessor: (row: any) => (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-blue-600 font-semibold">
                      {row.name
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{row.name}</p>
                    <p className="text-sm text-gray-500">{row.email}</p>
                  </div>
                </div>
              ),
            },
            {
              header: "Role",
              accessor: (row: any) => {
                const config = roleConfig(row.role);
                return (
                  <Badge variant={config.color as any}>{config.label}</Badge>
                );
              },
            },
            { header: "Phone", accessor: "phone" },
            {
              header: "Status",
              accessor: (row: any) => (
                <Badge variant={row.isActive ? "success" : "secondary"}>
                  {row.isActive ? "Active" : "Inactive"}
                </Badge>
              ),
            },
            {
              header: "Last Login",
              accessor: (row: any) =>
                row.lastLogin
                  ? new Date(row.lastLogin).toLocaleString()
                  : "Never",
            },
            {
              header: "Actions",
              accessor: (row: any) => (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditUser(row)}
                  >
                    <span className="material-symbols-outlined text-sm">
                      edit
                    </span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteUser(row.id)}
                  >
                    <span className="material-symbols-outlined text-sm text-red-500">
                      delete
                    </span>
                  </Button>
                </div>
              ),
            },
          ]}
          data={actions.filteredUsers}
          keyExtractor={(row: any) => row.id}
        />
      </Card>

      {/* Add/Edit User Modal */}
      <Modal
        isOpen={showAddModal || showEditModal}
        onClose={() => {
          setShowAddModal(false);
          setShowEditModal(false);
          setSelectedUser(null);
          setFormData({
            name: "",
            email: "",
            phone: "",
            role: "viewer",
            isActive: true,
            permissions: [],
          });
        }}
        title={selectedUser ? "Edit User" : "Add New User"}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name
            </label>
            <Input
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Enter full name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              placeholder="Enter email address"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <Input
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              placeholder="+256 700 000 000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              value={formData.role}
              onChange={(e) =>
                setFormData({ ...formData, role: e.target.value as any })
              }
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="admin">Administrator</option>
              <option value="bursar">Bursar</option>
              <option value="registrar">Registrar</option>
              <option value="teacher">Teacher</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) =>
                setFormData({ ...formData, isActive: e.target.checked })
              }
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="isActive" className="text-sm text-gray-700">
              Account is active
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowAddModal(false);
                setShowEditModal(false);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveUser} disabled={isSaving}>
              {isSaving
                ? "Saving..."
                : selectedUser
                  ? "Update User"
                  : "Add User"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function IntegrationsTab({
  settings,
  actions,
}: {
  settings: any;
  actions: any;
}) {
  const [showSMSTest, setShowSMSTest] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleTestSMS = async () => {
    setIsTesting(true);
    const result = await actions.sendTestSMS(testPhone);
    setTestResult(result);
    setIsTesting(false);
  };

  const handleSync = async () => {
    setIsSyncing(true);
    await actions.syncPaymentGateways();
    setIsSyncing(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Integrations</h2>
        <p className="text-gray-500">
          Manage payment gateways, SMS, and blockchain connections
        </p>
      </div>

      {/* Payment Gateways */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Payment Gateways</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={isSyncing}
          >
            <span className="material-symbols-outlined mr-2 text-sm">
              {isSyncing ? "sync" : "sync"}
            </span>
            {isSyncing ? "Syncing..." : "Sync All"}
          </Button>
        </div>

        <div className="space-y-4">
          {settings.paymentGateways.map((gateway: any) => (
            <div
              key={gateway.id}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`p-3 rounded-lg ${
                    gateway.provider === "mtn_momo"
                      ? "bg-yellow-100"
                      : gateway.provider === "airtel_money"
                        ? "bg-red-100"
                        : gateway.provider === "bank_transfer"
                          ? "bg-blue-100"
                          : "bg-gray-100"
                  }`}
                >
                  <span className="material-symbols-outlined">
                    {gateway.provider === "mtn_momo" ||
                    gateway.provider === "airtel_money"
                      ? "phone_android"
                      : gateway.provider === "bank_transfer"
                        ? "account_balance"
                        : gateway.provider === "cash"
                          ? "payments"
                          : "credit_card"}
                  </span>
                </div>
                <div>
                  <h4 className="font-medium">{gateway.name}</h4>
                  <p className="text-sm text-gray-500">
                    {gateway.lastSync
                      ? `Last sync: ${new Date(gateway.lastSync).toLocaleString()}`
                      : "Never synced"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <StatusIndicator status={gateway.status} />
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={gateway.isEnabled}
                    onChange={() => actions.togglePaymentGateway(gateway.id)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* SMS Configuration */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">SMS Configuration</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSMSTest(true)}
          >
            <span className="material-symbols-outlined mr-2 text-sm">send</span>
            Send Test SMS
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Provider</p>
            <p className="font-semibold capitalize">
              {settings.smsConfig.provider.replace("_", " ")}
            </p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Sender ID</p>
            <p className="font-semibold">{settings.smsConfig.senderId}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Balance</p>
            <p className="font-semibold">
              UGX {settings.smsConfig.balance?.toLocaleString()}
            </p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Status</p>
            <StatusIndicator
              status={
                settings.smsConfig.isEnabled ? "connected" : "disconnected"
              }
            />
          </div>
        </div>

        <h4 className="font-medium mb-3">SMS Templates</h4>
        <div className="space-y-3">
          {settings.smsConfig.templates.map((template: any) => (
            <div
              key={template.id}
              className="p-4 border border-gray-200 rounded-lg"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h5 className="font-medium">{template.name}</h5>
                  <Badge variant={template.isActive ? "success" : "secondary"}>
                    {template.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <Button variant="ghost" size="sm">
                  <span className="material-symbols-outlined text-sm">
                    edit
                  </span>
                </Button>
              </div>
              <p className="text-sm text-gray-600 font-mono bg-gray-50 p-2 rounded">
                {template.content}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Stellar Blockchain */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Stellar Blockchain</h3>
          <StatusIndicator status={settings.stellarConfig.status} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Network</p>
            <p className="font-semibold capitalize">
              {settings.stellarConfig.network}
            </p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Public Key</p>
            <p className="font-semibold font-mono text-xs truncate">
              {settings.stellarConfig.publicKey}
            </p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Total Anchored</p>
            <p className="font-semibold">
              {settings.stellarConfig.totalAnchored.toLocaleString()}{" "}
              transactions
            </p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Pending</p>
            <p className="font-semibold">
              {settings.stellarConfig.pendingAnchor} transactions
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
          <div>
            <p className="font-medium text-blue-900">Audit Trail Anchoring</p>
            <p className="text-sm text-blue-700">
              Last anchor:{" "}
              {settings.stellarConfig.lastAnchorTime
                ? new Date(
                    settings.stellarConfig.lastAnchorTime,
                  ).toLocaleString()
                : "Never"}
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.stellarConfig.isEnabled}
              onChange={() =>
                actions.updateStellarConfig({
                  isEnabled: !settings.stellarConfig.isEnabled,
                })
              }
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </Card>

      {/* SMS Test Modal */}
      <Modal
        isOpen={showSMSTest}
        onClose={() => {
          setShowSMSTest(false);
          setTestResult(null);
        }}
        title="Send Test SMS"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <Input
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="+256 700 000 000"
            />
          </div>

          {testResult && (
            <div
              className={`p-4 rounded-lg ${testResult.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined">
                  {testResult.success ? "check_circle" : "error"}
                </span>
                {testResult.message}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowSMSTest(false)}>
              Cancel
            </Button>
            <Button onClick={handleTestSMS} disabled={isTesting || !testPhone}>
              {isTesting ? "Sending..." : "Send Test"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function NotificationsTab({
  settings,
  actions,
}: {
  settings: any;
  actions: any;
}) {
  const [prefs, setPrefs] = useState(settings.notificationPrefs);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setPrefs(settings.notificationPrefs);
  }, [settings.notificationPrefs]);

  const handleSave = async () => {
    setIsSaving(true);
    await actions.updateNotificationPrefs(prefs);
    setIsSaving(false);
  };

  const togglePref = (key: keyof typeof prefs) => {
    setPrefs({ ...prefs, [key]: !prefs[key] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          Notification Settings
        </h2>
        <p className="text-gray-500">
          Configure how you receive alerts and updates
        </p>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Notification Channels</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <span className="material-symbols-outlined text-blue-600">
                  mail
                </span>
              </div>
              <div>
                <h4 className="font-medium">Email Notifications</h4>
                <p className="text-sm text-gray-500">
                  Receive important updates via email
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.emailNotifications}
                onChange={() => togglePref("emailNotifications")}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <span className="material-symbols-outlined text-green-600">
                  sms
                </span>
              </div>
              <div>
                <h4 className="font-medium">SMS Notifications</h4>
                <p className="text-sm text-gray-500">
                  Get instant SMS alerts for critical events
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.smsNotifications}
                onChange={() => togglePref("smsNotifications")}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Alert Types</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <h4 className="font-medium">Payment Alerts</h4>
              <p className="text-sm text-gray-500">
                Notifications when payments are received
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.paymentAlerts}
                onChange={() => togglePref("paymentAlerts")}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <h4 className="font-medium">Arrears Alerts</h4>
              <p className="text-sm text-gray-500">
                Notifications for overdue payments and arrears
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.arrearsAlerts}
                onChange={() => togglePref("arrearsAlerts")}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <h4 className="font-medium">System Alerts</h4>
              <p className="text-sm text-gray-500">
                Critical system and security notifications
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.systemAlerts}
                onChange={() => togglePref("systemAlerts")}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Reports & Digests</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <h4 className="font-medium">Daily Digest</h4>
              <p className="text-sm text-gray-500">
                Summary of daily activities sent each morning
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.dailyDigest}
                onChange={() => togglePref("dailyDigest")}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <h4 className="font-medium">Weekly Report</h4>
              <p className="text-sm text-gray-500">
                Comprehensive weekly financial summary
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.weeklyReport}
                onChange={() => togglePref("weeklyReport")}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Preferences"}
        </Button>
      </div>
    </div>
  );
}

function LogsTab({ settings, actions }: { settings: any; actions: any }) {
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const getLogLevelConfig = actions.getLogLevelConfig;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">System Logs</h2>
          <p className="text-gray-500">
            View system activity and debug information
          </p>
        </div>
        <Button variant="outline">
          <span className="material-symbols-outlined mr-2">download</span>
          Export Logs
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <select
            value={actions.logFilters.level}
            onChange={(e) =>
              actions.setLogFilters({
                ...actions.logFilters,
                level: e.target.value,
              })
            }
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Levels</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
            <option value="debug">Debug</option>
          </select>

          <select
            value={actions.logFilters.category}
            onChange={(e) =>
              actions.setLogFilters({
                ...actions.logFilters,
                category: e.target.value,
              })
            }
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Categories</option>
            <option value="auth">Authentication</option>
            <option value="payment">Payments</option>
            <option value="system">System</option>
            <option value="api">API</option>
            <option value="backup">Backup</option>
          </select>

          <select
            value={actions.logFilters.dateRange}
            onChange={(e) =>
              actions.setLogFilters({
                ...actions.logFilters,
                dateRange: e.target.value,
              })
            }
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </Card>

      {/* Logs Table */}
      <Card className="overflow-hidden">
        <Table
          columns={[
            {
              header: "Timestamp",
              accessor: (row: any) => (
                <span className="text-sm font-mono">
                  {new Date(row.timestamp).toLocaleString()}
                </span>
              ),
            },
            {
              header: "Level",
              accessor: (row: any) => {
                const config = getLogLevelConfig(row.level);
                return (
                  <Badge variant={config.color as any}>
                    <span className="material-symbols-outlined text-xs mr-1">
                      {config.icon}
                    </span>
                    {config.label}
                  </Badge>
                );
              },
            },
            {
              header: "Category",
              accessor: (row: any) => (
                <span className="capitalize text-sm">{row.category}</span>
              ),
            },
            { header: "Message", accessor: "message" },
            {
              header: "Actions",
              accessor: (row: any) => (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedLog(row)}
                >
                  <span className="material-symbols-outlined text-sm">
                    visibility
                  </span>
                </Button>
              ),
            },
          ]}
          data={actions.filteredLogs}
          keyExtractor={(row: any) => row.id}
        />
      </Card>

      {/* Log Detail Modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title="Log Details"
      >
        {selectedLog && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Timestamp</p>
                <p className="font-medium">
                  {new Date(selectedLog.timestamp).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Level</p>
                <Badge
                  variant={getLogLevelConfig(selectedLog.level).color as any}
                >
                  {getLogLevelConfig(selectedLog.level).label}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Category</p>
                <p className="font-medium capitalize">{selectedLog.category}</p>
              </div>
              {selectedLog.userId && (
                <div>
                  <p className="text-sm text-gray-500">User ID</p>
                  <p className="font-medium">{selectedLog.userId}</p>
                </div>
              )}
            </div>

            <div>
              <p className="text-sm text-gray-500 mb-1">Message</p>
              <p className="font-medium">{selectedLog.message}</p>
            </div>

            {selectedLog.details && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Details</p>
                <p className="text-sm bg-gray-50 p-3 rounded-lg font-mono">
                  {selectedLog.details}
                </p>
              </div>
            )}

            {selectedLog.ipAddress && (
              <div>
                <p className="text-sm text-gray-500">IP Address</p>
                <p className="font-medium font-mono">{selectedLog.ipAddress}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function AppearanceTab({ settings, actions }: { settings: any; actions: any }) {
  const [appSettings, setAppSettings] = useState(settings.appSettings);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setAppSettings(settings.appSettings);
  }, [settings.appSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    await actions.updateAppSettings(appSettings);
    setIsSaving(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          Appearance & Preferences
        </h2>
        <p className="text-gray-500">Customize your application experience</p>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Display Settings</h3>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Theme
            </label>
            <div className="grid grid-cols-3 gap-4">
              {["light", "dark", "system"].map((theme) => (
                <button
                  key={theme}
                  onClick={() =>
                    setAppSettings({ ...appSettings, theme: theme as any })
                  }
                  className={`p-4 border-2 rounded-lg text-center transition-colors ${
                    appSettings.theme === theme
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <span className="material-symbols-outlined text-2xl mb-2 block">
                    {theme === "light"
                      ? "light_mode"
                      : theme === "dark"
                        ? "dark_mode"
                        : "contrast"}
                  </span>
                  <span className="capitalize font-medium">{theme}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Language
            </label>
            <select
              value={appSettings.language}
              onChange={(e) =>
                setAppSettings({
                  ...appSettings,
                  language: e.target.value as any,
                })
              }
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="en">English</option>
              <option value="sw">Swahili</option>
              <option value="lg">Luganda</option>
            </select>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Regional Settings</h3>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Currency
            </label>
            <select
              value={appSettings.currency}
              onChange={(e) =>
                setAppSettings({
                  ...appSettings,
                  currency: e.target.value as any,
                })
              }
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="UGX">UGX - Ugandan Shilling</option>
              <option value="USD">USD - US Dollar</option>
              <option value="KES">KES - Kenyan Shilling</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date Format
            </label>
            <select
              value={appSettings.dateFormat}
              onChange={(e) =>
                setAppSettings({
                  ...appSettings,
                  dateFormat: e.target.value as any,
                })
              }
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY (26/01/2026)</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY (01/26/2026)</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD (2026-01-26)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Timezone
            </label>
            <select
              value={appSettings.timezone}
              onChange={(e) =>
                setAppSettings({ ...appSettings, timezone: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Africa/Kampala">Africa/Kampala (UTC+3)</option>
              <option value="Africa/Nairobi">Africa/Nairobi (UTC+3)</option>
              <option value="Africa/Dar_es_Salaam">
                Africa/Dar_es_Salaam (UTC+3)
              </option>
            </select>
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SettingsPage() {
  const {
    settings,
    isLoading,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    filteredUsers,
    userRoleFilter,
    setUserRoleFilter,
    addUser,
    updateUser,
    deleteUser,
    filteredLogs,
    logFilters,
    setLogFilters,
    updateSchoolInfo,
    updateSMSConfig,
    updateStellarConfig,
    updateBackupConfig,
    updateNotificationPrefs,
    updateAppSettings,
    togglePaymentGateway,
    testSMSConnection,
    sendTestSMS,
    syncPaymentGateways,
    createBackup,
    exportData,
    getRoleConfig,
    getLogLevelConfig,
    refreshData,
    isAuthenticated,
    authLoading,
    canManageSettings,
  } = useFirebaseSettings();

  const router = useRouter();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  if (isLoading || authLoading) {
    return <LoadingState />;
  }

  if (!settings) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-500">
          Failed to load settings. Please try again.
        </p>
        <Button onClick={refreshData} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: "overview", label: "Overview", icon: "dashboard" },
    { id: "users", label: "Users", icon: "group" },
    { id: "integrations", label: "Integrations", icon: "extension" },
    { id: "notifications", label: "Notifications", icon: "notifications" },
    { id: "logs", label: "System Logs", icon: "terminal" },
    { id: "appearance", label: "Appearance", icon: "palette" },
  ];

  const actions = {
    setActiveTab,
    searchQuery,
    setSearchQuery,
    filteredUsers,
    userRoleFilter,
    setUserRoleFilter,
    addUser,
    updateUser,
    deleteUser,
    filteredLogs,
    logFilters,
    setLogFilters,
    updateSchoolInfo,
    updateSMSConfig,
    updateStellarConfig,
    updateBackupConfig,
    updateNotificationPrefs,
    updateAppSettings,
    togglePaymentGateway,
    testSMSConnection,
    sendTestSMS,
    syncPaymentGateways,
    createBackup,
    exportData,
    getRoleConfig,
    getLogLevelConfig,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500">
          Manage your system configuration and preferences
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-1 overflow-x-auto pb-px">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <span className="material-symbols-outlined text-lg">
                {tab.icon}
              </span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <OverviewTab settings={settings} actions={actions} />
      )}
      {activeTab === "users" && (
        <UsersTab settings={settings} actions={actions} />
      )}
      {activeTab === "integrations" && (
        <IntegrationsTab settings={settings} actions={actions} />
      )}
      {activeTab === "notifications" && (
        <NotificationsTab settings={settings} actions={actions} />
      )}
      {activeTab === "logs" && (
        <LogsTab settings={settings} actions={actions} />
      )}
      {activeTab === "appearance" && (
        <AppearanceTab settings={settings} actions={actions} />
      )}
    </div>
  );
}
