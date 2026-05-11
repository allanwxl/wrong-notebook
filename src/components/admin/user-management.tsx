"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Trash2, Ban, CheckCircle, Loader2, Plus, UserPlus } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { AdminUser, AppConfig } from "@/types/api";

type CreateUserForm = {
    name: string;
    email: string;
    password: string;
    role: "user" | "teacher" | "admin";
    isActive: boolean;
    canUploadErrors: boolean;
};

const initialCreateUserForm: CreateUserForm = {
    name: "",
    email: "",
    password: "",
    role: "user",
    isActive: true,
    canUploadErrors: true,
};

export function UserManagement() {
    const { data: session } = useSession();
    const { t, language } = useLanguage();
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [allowRegistration, setAllowRegistration] = useState(true);
    const [savingRegistration, setSavingRegistration] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [createForm, setCreateForm] = useState<CreateUserForm>(initialCreateUserForm);

    useEffect(() => {
        fetchUsers();
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const data = await apiClient.get<AppConfig>("/api/settings");
            setAllowRegistration(data.allowRegistration !== false);
        } catch (error) {
            console.error("Failed to fetch config", error);
        }
    };

    const handleToggleRegistration = async (checked: boolean) => {
        setSavingRegistration(true);
        try {
            await apiClient.post("/api/settings", { allowRegistration: checked });
            setAllowRegistration(checked);
        } catch (error) {
            console.error("Failed to update registration setting", error);
            alert(t.common.error);
        } finally {
            setSavingRegistration(false);
        }
    };

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const data = await apiClient.get<AdminUser[]>("/api/admin/users");
            setUsers(data);
        } catch (error) {
            console.error("Failed to fetch users", error);
        } finally {
            setLoading(false);
        }
    };

    const roleLabel = (role: string) => {
        if (role === "admin") return "管理员";
        if (role === "teacher") return "老师";
        return "学生";
    };

    const handleToggleStatus = async (user: AdminUser) => {
        const confirmMsg = user.isActive
            ? t.admin.confirmDisable
            : t.admin.confirmEnable;

        if (!confirm(confirmMsg)) return;

        try {
            await apiClient.patch(`/api/admin/users/${user.id}`, { isActive: !user.isActive });
            fetchUsers();
        } catch (error) {
            console.error("Failed to update user status", error);
            alert(t.common.error);
        }
    };

    const handleRoleChange = async (user: AdminUser, role: string) => {
        try {
            await apiClient.patch(`/api/admin/users/${user.id}`, { role });
            fetchUsers();
        } catch (error: any) {
            console.error("Failed to update user role", error);
            alert(error.data?.message || t.common.error);
        }
    };

    const handleToggleUploadPermission = async (user: AdminUser, checked: boolean) => {
        try {
            await apiClient.patch(`/api/admin/users/${user.id}`, { canUploadErrors: checked });
            setUsers(prev => prev.map(item => item.id === user.id ? { ...item, canUploadErrors: checked } : item));
        } catch (error: any) {
            console.error("Failed to update upload permission", error);
            alert(error.data?.message || t.common.error);
        }
    };

    const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setCreating(true);
        try {
            const createdUser = await apiClient.post<AdminUser, CreateUserForm>("/api/admin/users", createForm);
            setUsers(prev => [createdUser, ...prev]);
            setCreateForm(initialCreateUserForm);
            setCreateOpen(false);
        } catch (error: any) {
            console.error("Failed to create user", error);
            alert(error.data?.message || t.common.error);
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (user: AdminUser) => {
        if (!confirm(t.admin.confirmDelete)) return;

        try {
            await apiClient.delete(`/api/admin/users/${user.id}`);
            fetchUsers();
        } catch (error: any) {
            console.error("Failed to delete user", error);
            const text = error.data?.message || t.common.error;
            alert(text);
        }
    };

    if (loading) {
        return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h3 className="text-base font-medium">用户管理</h3>
                    <p className="text-sm text-muted-foreground">创建用户并维护角色、账号状态和学生上传权限</p>
                </div>
                <Button onClick={() => setCreateOpen(true)} className="shrink-0">
                    <Plus className="h-4 w-4" />
                    创建用户
                </Button>
            </div>

            {/* 注册开关 */}
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                <div className="space-y-0.5">
                    <Label className="text-base">
                        {t.admin?.allowRegistration || "Allow New Registrations"}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                        {t.admin?.allowRegistrationDesc || "When disabled, new users cannot register"}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {savingRegistration && <Loader2 className="h-4 w-4 animate-spin" />}
                    <Switch
                        checked={allowRegistration}
                        onCheckedChange={handleToggleRegistration}
                        disabled={savingRegistration}
                    />
                </div>
            </div>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="sm:max-w-[520px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <UserPlus className="h-5 w-5" />
                            创建用户
                        </DialogTitle>
                        <DialogDescription>
                            管理员可直接创建学生、老师或管理员账号。
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateUser} className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="create-user-name">姓名</Label>
                                <Input
                                    id="create-user-name"
                                    value={createForm.name}
                                    onChange={(event) => setCreateForm(prev => ({ ...prev, name: event.target.value }))}
                                    disabled={creating}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="create-user-email">账号（邮箱或手机号）</Label>
                                <Input
                                    id="create-user-email"
                                    type="text"
                                    autoComplete="username"
                                    value={createForm.email}
                                    onChange={(event) => setCreateForm(prev => ({ ...prev, email: event.target.value }))}
                                    disabled={creating}
                                    required
                                />
                            </div>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="create-user-password">初始密码</Label>
                                <Input
                                    id="create-user-password"
                                    type="password"
                                    value={createForm.password}
                                    onChange={(event) => setCreateForm(prev => ({ ...prev, password: event.target.value }))}
                                    disabled={creating}
                                    minLength={6}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>角色</Label>
                                <Select
                                    value={createForm.role}
                                    onValueChange={(role: CreateUserForm["role"]) => setCreateForm(prev => ({ ...prev, role }))}
                                    disabled={creating}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="user">学生</SelectItem>
                                        <SelectItem value="teacher">老师</SelectItem>
                                        <SelectItem value="admin">管理员</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid gap-3 rounded-md border bg-muted/30 p-3">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <Label>启用账号</Label>
                                    <p className="text-xs text-muted-foreground">关闭后用户暂不能登录使用系统</p>
                                </div>
                                <Switch
                                    checked={createForm.isActive}
                                    onCheckedChange={(checked) => setCreateForm(prev => ({ ...prev, isActive: checked }))}
                                    disabled={creating}
                                />
                            </div>
                            {createForm.role === "user" && (
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <Label>允许上传错题</Label>
                                        <p className="text-xs text-muted-foreground">仅影响学生主动上传，不影响接收老师分配</p>
                                    </div>
                                    <Switch
                                        checked={createForm.canUploadErrors}
                                        onCheckedChange={(checked) => setCreateForm(prev => ({ ...prev, canUploadErrors: checked }))}
                                        disabled={creating}
                                    />
                                </div>
                            )}
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
                                取消
                            </Button>
                            <Button type="submit" disabled={creating}>
                                {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                                创建
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* 移动端卡片视图 */}
            <div className="sm:hidden space-y-3">
                {users.map((user) => (
                    <div key={user.id} className="border rounded-lg p-4 bg-card space-y-3">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="font-medium">{user.name || "N/A"}</div>
                                <div className="text-sm text-muted-foreground">{user.email}</div>
                            </div>
                            <Select
                                value={user.role || "user"}
                                onValueChange={(role) => handleRoleChange(user, role)}
                                disabled={user.id === (session?.user as any).id}
                            >
                                <SelectTrigger className="h-8 w-[104px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="user">学生</SelectItem>
                                    <SelectItem value="teacher">老师</SelectItem>
                                    <SelectItem value="admin">管理员</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {user.role === "user" && (
                            <div className="flex items-center justify-between rounded-md border bg-muted/30 p-2">
                                <span className="text-sm">允许上传错题</span>
                                <Switch
                                    checked={user.canUploadErrors !== false}
                                    onCheckedChange={(checked) => handleToggleUploadPermission(user, checked)}
                                />
                            </div>
                        )}
                        <div className="flex justify-between text-sm">
                            <div className="text-muted-foreground">
                                {t.admin.errors}: {user._count.errorItems} | {t.admin.practiceCount}: {user._count.practiceRecords}
                            </div>
                            <Badge variant={user.isActive ? "default" : "destructive"} className="text-xs">
                                {user.isActive ? t.admin.active : t.admin.disabled}
                            </Badge>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t">
                            <div className="text-xs text-muted-foreground">
                                {new Date(user.createdAt).toLocaleDateString()}
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleToggleStatus(user)}
                                    disabled={user.id === (session?.user as any).id}
                                >
                                    {user.isActive ? (
                                        <Ban className="h-4 w-4 text-orange-500" />
                                    ) : (
                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                    )}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(user)}
                                    disabled={user.id === (session?.user as any).id}
                                >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* 桌面端表格视图 */}
            <div className="hidden sm:block border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t.admin.nameEmail}</TableHead>
                            <TableHead>{t.admin.role}</TableHead>
                            <TableHead>{t.admin.stats}</TableHead>
                            <TableHead>上传权限</TableHead>
                            <TableHead>{t.admin.createdAt}</TableHead>
                            <TableHead>{t.admin.status}</TableHead>
                            <TableHead className="text-right">{t.admin.actions}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell>
                                    <div className="font-medium">{user.name || "N/A"}</div>
                                    <div className="text-sm text-muted-foreground">{user.email}</div>
                                </TableCell>
                                <TableCell>
                                    <Select
                                        value={user.role || "user"}
                                        onValueChange={(role) => handleRoleChange(user, role)}
                                        disabled={user.id === (session?.user as any).id}
                                    >
                                        <SelectTrigger className="h-8 w-[110px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="user">学生</SelectItem>
                                            <SelectItem value="teacher">老师</SelectItem>
                                            <SelectItem value="admin">管理员</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell>
                                    <div className="text-sm">
                                        {t.admin.errors}: {user._count.errorItems}
                                    </div>
                                    <div className="text-sm">
                                        {t.admin.practiceCount}: {user._count.practiceRecords}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {user.role === "user" ? (
                                        <div className="flex items-center gap-2">
                                            <Switch
                                                checked={user.canUploadErrors !== false}
                                                onCheckedChange={(checked) => handleToggleUploadPermission(user, checked)}
                                            />
                                            <span className="text-xs text-muted-foreground">
                                                {user.canUploadErrors !== false ? "允许" : "关闭"}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-muted-foreground">不适用</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {new Date(user.createdAt).toLocaleDateString()}
                                </TableCell>
                                <TableCell>
                                    <Badge variant={user.isActive ? "default" : "destructive"}>
                                        {user.isActive ? t.admin.active : t.admin.disabled}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right space-x-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleToggleStatus(user)}
                                        disabled={user.id === (session?.user as any).id}
                                        title={user.isActive ? t.admin.disable : t.admin.enable}
                                    >
                                        {user.isActive ? (
                                            <Ban className="h-4 w-4 text-orange-500" />
                                        ) : (
                                            <CheckCircle className="h-4 w-4 text-green-500" />
                                        )}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDelete(user)}
                                        disabled={user.id === (session?.user as any).id}
                                        title={t.admin.delete}
                                    >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
