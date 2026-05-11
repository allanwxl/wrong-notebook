"use client";

import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api-client";
import { Loader2, Users } from "lucide-react";

type AssignableStudent = {
    id: string;
    name: string | null;
    email: string;
    canUploadErrors: boolean;
};

interface AssignmentStudentSelectorProps {
    selectedIds: string[];
    onChange: (ids: string[]) => void;
}

export function AssignmentStudentSelector({ selectedIds, onChange }: AssignmentStudentSelectorProps) {
    const [students, setStudents] = useState<AssignableStudent[]>([]);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setLoading(true);
            apiClient.get<AssignableStudent[]>("/api/teacher/students", query ? { params: { query } } : undefined)
                .then(setStudents)
                .catch(() => setStudents([]))
                .finally(() => setLoading(false));
        }, 200);

        return () => window.clearTimeout(timer);
    }, [query]);

    const toggleStudent = (studentId: string, checked: boolean) => {
        if (checked) {
            onChange(Array.from(new Set([...selectedIds, studentId])));
            return;
        }
        onChange(selectedIds.filter((id) => id !== studentId));
    };

    return (
        <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <Label className="text-sm font-medium">分配给学生</Label>
                </div>
                <span className="text-xs text-muted-foreground">已选择 {selectedIds.length} 人</span>
            </div>
            <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="按姓名或邮箱搜索学生"
            />
            <div className="max-h-44 overflow-y-auto rounded-md border bg-background">
                {loading ? (
                    <div className="flex items-center justify-center py-6 text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        加载中
                    </div>
                ) : students.length === 0 ? (
                    <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                        暂无可分配的激活学生
                    </div>
                ) : (
                    students.map((student) => (
                        <label
                            key={student.id}
                            className="flex cursor-pointer items-center gap-3 border-b px-3 py-2 last:border-b-0 hover:bg-muted/50"
                        >
                            <Checkbox
                                checked={selectedIds.includes(student.id)}
                                onCheckedChange={(checked) => toggleStudent(student.id, checked === true)}
                            />
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium">{student.name || student.email}</span>
                                <span className="block truncate text-xs text-muted-foreground">{student.email}</span>
                            </span>
                            {student.canUploadErrors === false && (
                                <span className="text-[11px] text-muted-foreground">上传关闭</span>
                            )}
                        </label>
                    ))
                )}
            </div>
        </div>
    );
}
