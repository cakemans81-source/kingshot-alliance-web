"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/AuthContext";

export default function ProfilePage() {
    const router = useRouter();
    const { user, updateUser, logout } = useAuth();

    const [nickname, setNickname] = useState("");
    const [bio, setBio] = useState("");
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fileRef = useRef<HTMLInputElement>(null);

    /* 로그인 체크 및 데이터 초기화 */
    useEffect(() => {
        if (user === null) {
            router.replace("/auth");
        } else {
            setNickname(user.nickname);
            setBio(user.bio ?? "");
            setAvatarUrl(user.avatar_url);
        }
    }, [user, router]);

    if (!user) return null;

    /* 사진 업로드 핸들러 */
    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setUploading(true);
            setError(null);

            if (!e.target.files || e.target.files.length === 0) return;
            const file = e.target.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}-${Math.random()}.${fileExt}`;
            const filePath = `avatars/${fileName}`;

            // 1. Supabase Storage에 업로드 (avatars 버킷이 public으로 생성되어 있어야 함)
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 2. 공개 URL 가져오기
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            setAvatarUrl(publicUrl);

            // 3. 즉시 DB 업데이트 (선택 사항이지만 사용자 경험을 위해)
            await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', user.id);
            updateUser({ avatar_url: publicUrl });

            setSuccess(true);
            setTimeout(() => setSuccess(false), 2000);

        } catch (err: any) {
            setError("사진 업로드 실패: " + err.message + "\n(Supabase Storage에 'avatars' 버킷이 있는지 확인해주세요)");
        } finally {
            setUploading(false);
        }
    };

    /* 정보 저장 핸들러 */
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nickname.trim()) { setError("닉네임을 입력해 주세요."); return; }
        setSaving(true); setError(null); setSuccess(false);

        const { error: err } = await supabase
            .from("users")
            .update({
                nickname: nickname.trim(),
                bio: bio.trim() || null,
                avatar_url: avatarUrl
            })
            .eq("id", user.id);

        if (err) {
            setError("저장 실패: " + err.message);
        } else {
            updateUser({
                nickname: nickname.trim(),
                bio: bio.trim() || null,
                avatar_url: avatarUrl
            });
            setSuccess(true);
            setTimeout(() => setSuccess(false), 2500);
        }
        setSaving(false);
    };

    const roleLabel: Record<string, string> = {
        admin: "👑 총사령관 (관리자)",
        staff: "⭐ 간부 (운영진)",
        member: "🛡️ 정예 연맹원",
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-gray-950 flex items-center justify-center px-4 py-16">
            <div className="w-full max-w-md">

                {/* 헤더 & 프로필 이미지 */}
                <div className="text-center mb-8 relative">
                    <div className="relative inline-block group">
                        <div className="w-24 h-24 rounded-3xl mb-4 overflow-hidden flex items-center justify-center transition-transform group-hover:scale-105"
                            style={{
                                background: "linear-gradient(135deg,rgba(6,182,212,0.2),rgba(99,102,241,0.2))",
                                border: "2px solid rgba(6,182,212,0.35)",
                                boxShadow: "0 0 20px rgba(6,182,212,0.15)"
                            }}>
                            {avatarUrl ? (
                                <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-4xl">👤</span>
                            )}

                            {/* 업로드 오버레이 */}
                            <button
                                onClick={() => fileRef.current?.click()}
                                disabled={uploading}
                                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold"
                            >
                                {uploading ? "업로드 중..." : "사진 변경"}
                            </button>
                        </div>
                        <input
                            type="file"
                            ref={fileRef}
                            onChange={handleAvatarUpload}
                            accept="image/*"
                            className="hidden"
                        />
                    </div>

                    <h1 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-indigo-400">
                        내 프로필
                    </h1>

                    {/* 현재 권한 뱃지 (실시간 반영) */}
                    <div className="mt-2 text-center">
                        <span
                            className="inline-flex items-center gap-1.5 text-[11px] font-black px-3 py-1 rounded-full uppercase tracking-wider"
                            style={{
                                background: user.role === "admin" ? "rgba(251,191,36,0.15)" : user.role === "staff" ? "rgba(99,102,241,0.15)" : "rgba(71,85,105,0.2)",
                                color: user.role === "admin" ? "#fbbf24" : user.role === "staff" ? "#818cf8" : "#94a3b8",
                                border: `1px solid ${user.role === "admin" ? "rgba(251,191,36,0.3)" : user.role === "staff" ? "rgba(99,102,241,0.3)" : "rgba(71,85,105,0.3)"}`,
                                boxShadow: user.role === "admin" ? "0 0 10px rgba(251,191,36,0.1)" : "none"
                            }}
                        >
                            {roleLabel[user.role] ?? user.role}
                        </span>
                    </div>
                </div>

                {/* 정보 카드 */}
                <div className="rounded-2xl p-6 space-y-5"
                    style={{ background: "rgba(15,23,42,0.85)", border: "1px solid rgba(51,65,85,0.55)", backdropFilter: "blur(12px)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>

                    {/* 에러 / 성공 메시지 */}
                    {error && (
                        <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-[11px] text-red-400 whitespace-pre-line leading-relaxed">
                            ⚠️ {error}
                        </div>
                    )}
                    {success && (
                        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 text-sm text-emerald-400 animate-pulse">
                            ✅ 정보가 성공적으로 반영되었습니다!
                        </div>
                    )}

                    {/* 읽기 전용 정보 */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="block text-[10px] uppercase font-bold text-slate-500 ml-1">게임 ID (고유)</label>
                            <div className="w-full rounded-xl px-4 py-2.5 text-xs text-slate-500 bg-slate-900/50 border border-slate-800 font-mono">
                                {user.game_id}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="block text-[10px] uppercase font-bold text-slate-500 ml-1">나의 역할</label>
                            <div className="w-full rounded-xl px-4 py-2.5 text-xs text-indigo-300 bg-indigo-500/5 border border-indigo-500/20 font-bold capitalize">
                                {user.role}
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleSave} className="space-y-4">
                        {/* 닉네임 */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-slate-400 ml-1">닉네임 <span className="text-red-400">*</span></label>
                            <input
                                type="text" value={nickname} onChange={(e) => setNickname(e.target.value)}
                                placeholder="활동할 닉네임을 입력하세요" maxLength={20}
                                className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-700 outline-none transition-all"
                                style={{ background: "rgba(30,41,59,0.8)", border: "1px solid rgba(71,85,105,0.5)" }}
                                onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 2px rgba(6,182,212,0.4)")}
                                onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                            />
                        </div>

                        {/* 자기소개 */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-slate-400 ml-1">연맹 한 줄 소개 <span className="text-slate-600 font-normal">(선택)</span></label>
                            <textarea
                                value={bio} onChange={(e) => setBio(e.target.value)}
                                placeholder="연맹원들에게 보여줄 소개를 입력하세요" maxLength={100} rows={3}
                                className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-700 outline-none resize-none transition-all leading-relaxed"
                                style={{ background: "rgba(30,41,59,0.8)", border: "1px solid rgba(71,85,105,0.5)" }}
                                onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 2px rgba(6,182,212,0.4)")}
                                onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                            />
                        </div>

                        <div className="flex flex-col gap-3 pt-2">
                            <button
                                type="submit"
                                disabled={saving || uploading}
                                className="w-full py-4 rounded-xl text-sm font-black text-white transition-all duration-200 disabled:opacity-50 hover:brightness-110 active:scale-[0.98]"
                                style={{
                                    background: "linear-gradient(135deg,#06b6d4,#6366f1)",
                                    boxShadow: "0 4px 20px rgba(6,182,212,0.3)"
                                }}
                            >
                                {saving ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        업데이트 중…
                                    </span>
                                ) : "저장하고 반영하기"}
                            </button>

                            <button
                                type="button"
                                onClick={() => { logout(); router.push("/"); }}
                                className="w-full py-3 rounded-xl text-xs font-bold text-slate-500 hover:text-red-400 hover:bg-red-500/5 transition-all duration-200"
                                style={{ border: "1px solid rgba(71,85,105,0.3)" }}
                            >
                                🚪 계정 로그아웃
                            </button>
                        </div>
                    </form>
                </div>

                <p className="text-center text-[10px] text-slate-600 mt-6 tracking-tight">
                    계정 정보를 수정하면 모든 게시글과 댓글에 즉시 반영됩니다.
                </p>
            </div>
        </div>
    );
}
