"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { categories, type AnswerMode, type PollVisibility } from "@/app/data/mock";
import { invalidateProfileCaches } from "@/app/lib/profileCache";
import { SmartBackButton } from "@/app/components/SmartBackButton";
import { AdminAiAssistant, type QuestionSuggestion } from "./AdminAiAssistant";
import { AdminAiImageGenerator } from "./AdminAiImageGenerator";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = pad2(now.getMonth() + 1);
  const day = pad2(now.getDate());
  return `${year}-${month}-${day}`;
}

function getMinTimeStringForDate(date: string): string {
  const today = getTodayDateString();
  if (!date || date !== today) return "00:00";

  const now = new Date();
  now.setMinutes(now.getMinutes() + 5);
  const hour = pad2(now.getHours());
  const minute = pad2(now.getMinutes());
  return `${hour}:${minute}`;
}

function getPreviewCategoryLetter(category: string, customCategory: string, useCustomCategory: boolean): string {
  const value = (useCustomCategory ? customCategory : category).trim();
  return value.charAt(0).toUpperCase() || "?";
}

async function resizeImageClientSide(file: File, maxWidth: number, maxHeight: number): Promise<Blob> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Bild konnte nicht gelesen werden."));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Bild konnte nicht geladen werden."));
    img.src = dataUrl;
  });

  const { width, height } = image;
  if (!width || !height) {
    throw new Error("Bild hat keine gültigen Abmessungen.");
  }

  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  const targetWidth = Math.round(width * scale);
  const targetHeight = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas-Kontext konnte nicht initialisiert werden.");
  }

  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error("Bild konnte nicht verkleinert werden."));
      },
      "image/jpeg",
      0.8
    );
  });

  return blob;
}

type UploadImageJson = { imageUrl?: string; error?: string };

const MAX_ORIGINAL_IMAGE_BYTES = 20 * 1024 * 1024; // 20 MB

function uploadImageWithProgress(
  formData: FormData,
  onProgress: (pct: number) => void
): Promise<UploadImageJson> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload-image");
    xhr.responseType = "json";
    xhr.timeout = 30000;

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const pct = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)));
      onProgress(pct);
    };

    xhr.onload = () => {
      const jsonFromResponse = xhr.response as UploadImageJson | null;
      let json: UploadImageJson | null = jsonFromResponse;
      if (!json && xhr.responseText) {
        try {
          json = JSON.parse(xhr.responseText) as UploadImageJson;
        } catch {
          json = null;
        }
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(json ?? {});
        return;
      }

      const message =
        json?.error ??
        (xhr.status == 413
          ? "Die Datei ist zu groß."
          : xhr.status == 415
          ? "Ungültiges Bildformat."
          : "Das Bild konnte nicht hochgeladen werden.");
      reject(new Error(message));
    };

    xhr.onerror = () => reject(new Error("Netzwerkfehler beim Bild-Upload."));
    xhr.ontimeout = () => reject(new Error("Zeitüberschreitung beim Bild-Upload."));

    xhr.send(formData);
  });
}

export default function NewDraftPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [aiImagePrompt, setAiImagePrompt] = useState("");
  const [category, setCategory] = useState<string>(categories[0]?.label ?? "");
  const [useCustomCategory, setUseCustomCategory] = useState(false);
  const [customCategory, setCustomCategory] = useState("");

  const [regionSelect, setRegionSelect] = useState<string>("Global");
  const [customRegion, setCustomRegion] = useState("");

  const [visibility, setVisibility] = useState<PollVisibility>("public");

  const [pollKind, setPollKind] = useState<"prognose" | "meinung">("prognose");
  const isResolvable = pollKind === "prognose";
  const [answerMode, setAnswerMode] = useState<AnswerMode>("binary");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);

  const [resolutionCriteria, setResolutionCriteria] = useState("");
  const [resolutionSource, setResolutionSource] = useState("");
  const [resolutionDeadlineDate, setResolutionDeadlineDate] = useState<string>("");
  const [resolutionDeadlineTime, setResolutionDeadlineTime] = useState<string>("");

  const [timeLeftHours, setTimeLeftHours] = useState<number>(72);
  const [endDate, setEndDate] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const minEndDate = getTodayDateString();
  const minResolutionDate = getTodayDateString();
  const minResolutionTime = getMinTimeStringForDate(resolutionDeadlineDate || minResolutionDate);
  const isPrivatePoll = visibility === "link_only";
  const effectiveMinResolutionTime =
    (resolutionDeadlineDate || minResolutionDate) === minResolutionDate ? minResolutionTime : "00:00";

  useEffect(() => {
    if (!isPrivatePoll) return;
    if (!endDate) {
      setEndDate(minEndDate);
    }
  }, [isPrivatePoll, endDate, minEndDate]);

  useEffect(() => {
    if (!isPrivatePoll) return;
    const date = endDate || minEndDate;
    const nextMinTime = getMinTimeStringForDate(date);
    if (!endTime || endTime < nextMinTime) {
      setEndTime(nextMinTime);
    }
  }, [isPrivatePoll, endDate, endTime, minEndDate]);

  useEffect(() => {
    if (isResolvable) return;
    setResolutionCriteria("");
    setResolutionSource("");
    setResolutionDeadlineDate("");
    setResolutionDeadlineTime("");
  }, [isResolvable]);

  const [imageUrl, setImageUrl] = useState("");
  const [imageCredit, setImageCredit] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageUploadPhase, setImageUploadPhase] = useState<"idle" | "resizing" | "uploading">("idle");
  const [imageUploadProgress, setImageUploadProgress] = useState(0);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  type CurrentUser =
    | {
        id: string;
        email: string;
        displayName: string;
        role?: string;
        emailVerified?: boolean;
      }
    | null;

  const [currentUser, setCurrentUser] = useState<CurrentUser>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const previewImageUrl = imagePreviewUrl || imageUrl || "";

  type SimilarMatch = {
    id: string;
    title: string;
    closesAt: string;
    ended: boolean;
    status: string | null;
    score: number;
  };

  const [similarMatches, setSimilarMatches] = useState<SimilarMatch[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [similarError, setSimilarError] = useState<string | null>(null);
  const similarCacheRef = useRef(new Map<string, SimilarMatch[]>());
  const lastSimilarQueryRef = useRef<string>("");
  const lastSimilarWordsRef = useRef<string[]>([]);

  const vagueTitleHits = useMemo(() => {
    const t = title.toLowerCase();
    const words = [
      "bald",
      "besser",
      "schlechter",
      "groß",
      "gross",
      "wahrscheinlich",
      "vielleicht",
      "erfolgreich",
      "stark",
      "schwach",
      "massiv",
      "deutlich",
      "spürbar",
      "spuerbar",
      "irgendwann",
      "wird es",
    ];
    return words.filter((w) => t.includes(w));
  }, [title]);

  useEffect(() => {
    const query = title.trim();
    if (query.length < 8) {
      setSimilarMatches([]);
      setSimilarError(null);
      setSimilarLoading(false);
      return;
    }

    setSimilarError(null);

    const normalizedQuery = query.replace(/\s+/g, " ").trim();
    const cacheKey = normalizedQuery.toLowerCase();
    const cached = similarCacheRef.current.get(cacheKey);
    if (cached) {
      setSimilarMatches(cached);
      setSimilarLoading(false);
      return;
    }

    const prevQuery = lastSimilarQueryRef.current;
    const prevWords = lastSimilarWordsRef.current;
    const currentWords = normalizedQuery.toLowerCase().split(" ").filter(Boolean);

    if (prevQuery) {
      const lengthDelta = Math.abs(normalizedQuery.length - prevQuery.length);
      const sameWordCount = currentWords.length === prevWords.length;
      const endsWithSpace = query.endsWith(" ");
      const significantChange = lengthDelta >= 4 || !sameWordCount || endsWithSpace;
      if (!significantChange) {
        setSimilarLoading(false);
        return;
      }
    }

    setSimilarLoading(true);

    const handle = setTimeout(() => {
      void fetch(`/api/questions/similar?q=${encodeURIComponent(normalizedQuery)}`)
        .then((res) => res.json())
        .then((data) => {
          if (!data?.ok) {
            setSimilarError(data?.error ?? "Duplikat-Check fehlgeschlagen.");
            setSimilarMatches([]);
            return;
          }
          const matches = (data?.matches ?? []) as SimilarMatch[];
          similarCacheRef.current.set(cacheKey, matches);
          lastSimilarQueryRef.current = normalizedQuery;
          lastSimilarWordsRef.current = currentWords;
          setSimilarMatches(matches);
        })
        .catch(() => {
          setSimilarError("Duplikat-Check fehlgeschlagen.");
          setSimilarMatches([]);
        })
        .finally(() => setSimilarLoading(false));
    }, 900);

    return () => clearTimeout(handle);
  }, [title]);

  useEffect(() => {
    // aktuellen User laden
    setLoadingUser(true);
    void fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => setCurrentUser(data.user ?? null))
      .catch(() => setCurrentUser(null))
      .finally(() => setLoadingUser(false));

    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  useEffect(() => {
    // Private Umfragen brauchen immer ein Enddatum (Abstimmungsende).
    if (!isPrivatePoll) return;
    if (endDate) return;
    setEndDate(minEndDate);
  }, [endDate, isPrivatePoll, minEndDate]);

  useEffect(() => {
    if (!isPrivatePoll) return;
    if (endTime) return;
    setEndTime(getMinTimeStringForDate(endDate || minEndDate));
  }, [endDate, endTime, isPrivatePoll, minEndDate]);

  useEffect(() => {
    if (resolutionDeadlineDate) return;
    setResolutionDeadlineDate(endDate || minEndDate);
  }, [endDate, minEndDate, resolutionDeadlineDate]);

  useEffect(() => {
    if (resolutionDeadlineTime) return;
    const baseDate = resolutionDeadlineDate || endDate || minEndDate;
    const minTime = getMinTimeStringForDate(baseDate);
    const suggested = endTime && endTime >= minTime ? endTime : minTime;
    setResolutionDeadlineTime(suggested);
  }, [endDate, endTime, minEndDate, resolutionDeadlineDate, resolutionDeadlineTime]);

  const navigateHome = useCallback(
    (withSuccessFlag: boolean) => {
      setIsLeaving(true);
      setTimeout(() => {
        router.push(withSuccessFlag ? "/?draft=submitted" : "/");
      }, 190);
    },
    [router]
  );

  const isAdmin = currentUser?.role === "admin";

  const applyAiSuggestion = useCallback((s: QuestionSuggestion) => {
    const nextPollKind: "prognose" | "meinung" = s.isResolvable !== false ? "prognose" : "meinung";
    setPollKind(nextPollKind);

    const nextAnswerMode: AnswerMode = s.answerMode === "options" ? "options" : "binary";
    setAnswerMode(nextAnswerMode);
    if (nextAnswerMode === "options") {
      const raw = Array.isArray((s as any).options) ? ((s as any).options as unknown[]) : [];
      const normalized = raw
        .map((v) => (typeof v === "string" ? v.trim() : ""))
        .filter(Boolean)
        .slice(0, 6);
      const unique: string[] = [];
      const seen = new Set<string>();
      for (const opt of normalized) {
        const key = opt.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(opt);
        if (unique.length >= 6) break;
      }
      const padded = unique.length >= 2 ? unique : [...unique, ...Array.from({ length: 2 - unique.length }, () => "")];
      setPollOptions(padded);
    } else {
      setPollOptions(["", ""]);
    }

    setTitle(s.title ?? "");
    setDescription(s.description ?? "");
    setAiImagePrompt(typeof (s as any).imagePrompt === "string" ? (s as any).imagePrompt : "");

    const knownCategory = categories.some((c) => c.label === s.category);
    if (knownCategory) {
      setUseCustomCategory(false);
      setCategory(s.category);
      setCustomCategory("");
    } else {
      setUseCustomCategory(true);
      setCategory(categories[0]?.label ?? "");
      setCustomCategory(s.category ?? "");
    }

    const regionValue = (s.region ?? "").trim();
    if (!regionValue || regionValue.toLowerCase() === "global" || regionValue.toLowerCase() === "alle") {
      setRegionSelect("Global");
      setCustomRegion("");
    } else if (["Deutschland", "Europa", "DACH"].includes(regionValue)) {
      setRegionSelect(regionValue);
      setCustomRegion("");
    } else {
      setRegionSelect("__custom_region");
      setCustomRegion(regionValue);
    }

    const reviewHours = Number(s.reviewHours);
    if (Number.isFinite(reviewHours) && reviewHours > 0) {
      setTimeLeftHours(Math.round(reviewHours));
    }

    const pollEndMs = Date.parse(s.pollEndAt);
    if (Number.isFinite(pollEndMs)) {
      const d = new Date(pollEndMs);
      const yyyy = d.getFullYear();
      const mm = pad2(d.getMonth() + 1);
      const dd = pad2(d.getDate());
      const hh = pad2(d.getHours());
      const mi = pad2(d.getMinutes());
      setEndDate(`${yyyy}-${mm}-${dd}`);
      setEndTime(`${hh}:${mi}`);
    }

    if (nextPollKind === "prognose") {
      setResolutionCriteria(s.resolutionCriteria ?? "");
      setResolutionSource(s.resolutionSource ?? (s.sources?.[0] ?? ""));

      const resMs = Date.parse(s.resolutionDeadlineAt);
      if (Number.isFinite(resMs)) {
        const d = new Date(resMs);
        const yyyy = d.getFullYear();
        const mm = pad2(d.getMonth() + 1);
        const dd = pad2(d.getDate());
        const hh = pad2(d.getHours());
        const mi = pad2(d.getMinutes());
        setResolutionDeadlineDate(`${yyyy}-${mm}-${dd}`);
        setResolutionDeadlineTime(`${hh}:${mi}`);
      }
    } else {
      setResolutionCriteria("");
      setResolutionSource("");
      setResolutionDeadlineDate("");
      setResolutionDeadlineTime("");
    }
  }, []);

  const adoptAiImageFile = useCallback((file: File, previewUrl: string) => {
    setImageError(null);

    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    setImageFile(file);
    setImagePreviewUrl(previewUrl);
    setImageUrl("");
  }, [imagePreviewUrl]);

  const handleFormKeyDown = (event: React.KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== "Enter") return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.tagName !== "TEXTAREA") {
      event.preventDefault();
    }
  };

  const handleResendVerification = async () => {
    setResendStatus("sending");
    setResendMessage(null);
    try {
      const res = await fetch("/api/auth/resend-verification", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error ?? "Fehler beim Senden");
      }
      if (data.alreadyVerified) {
        setResendMessage("Deine E-Mail-Adresse ist bereits bestätigt.");
      } else {
        setResendMessage(
          "Ein neuer Verifikationslink wurde versendet. Bitte prüfe deine E-Mails (oder das Server-Log im Testmodus)."
        );
      }
      setResendStatus("sent");
    } catch (err) {
      console.error(err);
      setResendStatus("error");
      setResendMessage("Verifikationslink konnte nicht gesendet werden. Bitte versuche es später noch einmal.");
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();

    if (!trimmedTitle) {
      setError("Bitte gib einen Titel für deine Frage ein.");
      return;
    }
    if (trimmedTitle.length < 10) {
      setError("Der Titel sollte mindestens 10 Zeichen lang sein, damit die Frage verständlich ist.");
      return;
    }

    let finalCategory = useCustomCategory ? customCategory.trim() : category.trim();
    if (!finalCategory) {
      setError("Bitte wähle eine Kategorie oder gib eine eigene ein.");
      return;
    }
    if (useCustomCategory && finalCategory.length < 3) {
      setError("Die eigene Kategorie sollte mindestens 3 Zeichen haben.");
      return;
    }

    let finalRegion = "";
    if (regionSelect === "__custom_region") {
      finalRegion = customRegion.trim();
    } else if (regionSelect === "Global") {
      // Global explizit als Region speichern, damit es in der DB sichtbar ist
      finalRegion = "Global";
    } else {
      finalRegion = regionSelect;
    }

    // Review-Zeitraum (nur öffentliche Fragen): wie lange die Community den Draft bewertet.
    const finalTimeLeftHours = Math.round(timeLeftHours || 72);
    if (!isPrivatePoll) {
      if (!Number.isFinite(finalTimeLeftHours) || finalTimeLeftHours <= 0) {
        setError("Bitte gib eine gültige Review-Dauer in Stunden an.");
        return;
      }
    }

    // Abstimmungsende (Vote-Ende): privat = Pflicht, öffentlich = optional (Default: +14 Tage ab Veröffentlichung im Feed)
    let finalClosesAt: string | undefined;
    const composedEndDateTime = endDate && endTime ? `${endDate}T${endTime}` : "";
    if (composedEndDateTime) {
      const closesAt = new Date(composedEndDateTime);
      const now = new Date();
      if (Number.isNaN(closesAt.getTime()) || closesAt <= now) {
        setError("Das gewählte Enddatum liegt in der Vergangenheit. Bitte wähle einen Zeitpunkt in der Zukunft.");
        return;
      }
      finalClosesAt = closesAt.toISOString();
    } else if (isPrivatePoll) {
      setError("Bitte wähle Datum und Uhrzeit, bis wann die private Umfrage laufen soll.");
      return;
    } else if (typeof window !== "undefined") {
      const ok = window.confirm(
        "Du hast kein Enddatum für die Abstimmung angegeben. Standardmäßig läuft die Abstimmung 14 Tage ab Veröffentlichung im Feed. Möchtest du fortfahren?"
      );
      if (!ok) {
        return;
      }
    }

    const optionsToSend =
      answerMode === "options"
        ? pollOptions
            .map((v) => v.trim())
            .filter((v) => v.length > 0)
            .slice(0, 6)
        : undefined;

    if (answerMode === "options") {
      if (!optionsToSend || optionsToSend.length < 2) {
        setError("Bitte gib mindestens 2 Antwortoptionen an.");
        return;
      }

      const seen = new Set<string>();
      for (const label of optionsToSend) {
        if (label.length > 80) {
          setError("Eine Option ist zu lang (max. 80 Zeichen).");
          return;
        }
        const key = label.toLocaleLowerCase("de-DE");
        if (seen.has(key)) {
          setError("Antwortoptionen muessen eindeutig sein.");
          return;
        }
        seen.add(key);
      }
    }

    const trimmedResolutionCriteria = resolutionCriteria.trim();
    const trimmedResolutionSource = resolutionSource.trim();
    const composedResolutionDeadline =
      resolutionDeadlineDate && resolutionDeadlineTime
        ? `${resolutionDeadlineDate}T${resolutionDeadlineTime}`
        : "";
    const resolutionDeadline = composedResolutionDeadline
      ? new Date(composedResolutionDeadline).toISOString()
      : undefined;

    const shouldSendResolution = visibility === "public" && isResolvable;
    const resolutionCriteriaToSend = shouldSendResolution ? trimmedResolutionCriteria || undefined : undefined;
    const resolutionSourceToSend = shouldSendResolution ? trimmedResolutionSource || undefined : undefined;
    const resolutionDeadlineToSend = shouldSendResolution ? resolutionDeadline : undefined;

    if (visibility === "public" && isResolvable) {
      if (!trimmedResolutionCriteria) {
        setError("Bitte beschreibe, wie die Frage aufgeloest wird (Aufloesungs-Regeln).");
        return;
      }
      if (!trimmedResolutionSource) {
        setError("Bitte gib eine Quelle an (z. B. offizielle Seite/Institution oder Link).");
        return;
      }
      if (!resolutionDeadline || Number.isNaN(Date.parse(resolutionDeadline))) {
        setError("Bitte setze eine Aufloesungs-Deadline (Datum/Uhrzeit).");
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    setImageError(null);

    try {
      let finalImageUrl: string | undefined = imageUrl.trim() || undefined;

      if (imageFile) {
        setImageUploadProgress(0);
        setImageUploadPhase("resizing");

        try {
          const resizedBlob = await resizeImageClientSide(imageFile, 250, 150);
          const uploadData = new FormData();
          uploadData.append("file", resizedBlob, imageFile.name || "image.jpg");

          setImageUploadPhase("uploading");
          const uploadJson = await uploadImageWithProgress(uploadData, (pct) => setImageUploadProgress(pct));

          if (!uploadJson?.imageUrl) {
            setImageError(uploadJson?.error ?? "Das Bild konnte nicht hochgeladen werden.");
            return;
          }

          finalImageUrl = uploadJson.imageUrl;
        } catch (err) {
          console.error(err);
          setImageError(err instanceof Error ? err.message : "Das Bild konnte nicht hochgeladen werden.");
          return;
        } finally {
          setImageUploadPhase("idle");
          setImageUploadProgress(0);
        }
      }


      const trimmedImageCredit = imageCredit.trim();

      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          description: trimmedDescription || undefined,
          category: finalCategory,
          region: finalRegion || "Global",
          visibility,
          answerMode,
          isResolvable,
          options: optionsToSend,
          imageUrl: finalImageUrl,
          imageCredit: trimmedImageCredit || undefined,
          timeLeftHours: isPrivatePoll ? undefined : finalTimeLeftHours,
          closesAt: finalClosesAt,
          resolutionCriteria: resolutionCriteriaToSend,
          resolutionSource: resolutionSourceToSend,
          resolutionDeadline: resolutionDeadlineToSend,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Konnte deine Frage nicht speichern.");
        return;
      }

      invalidateProfileCaches();

      const createdDraft = data?.draft as { shareId?: string } | null;
      const createdQuestion = data?.question as { shareId?: string } | null;
      const createdShareId =
        typeof createdDraft?.shareId === "string"
          ? createdDraft.shareId
          : typeof createdQuestion?.shareId === "string"
            ? createdQuestion.shareId
            : null;

      if (visibility === "link_only" && createdShareId) {
        setIsLeaving(true);
        setTimeout(() => {
          router.push(`/p/${encodeURIComponent(createdShareId)}?created=1`);
        }, 190);
        return;
      }

      navigateHome(true);
    } catch (err) {
      console.error(err);
      setError("Netzwerkfehler. Bitte versuche es erneut.");
    } finally {
      setSubmitting(false);
    }
  };

  const currentCategoryLabel = (useCustomCategory ? customCategory : category) || "Kategorie";

  const previewCard = (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-md shadow-emerald-500/10">
      <div className="flex items-start gap-3 text-xs font-semibold text-slate-100">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-base text-emerald-100">
          {getPreviewCategoryLetter(category, customCategory, useCustomCategory)}
        </span>
        <div className="flex flex-col leading-tight">
          <span className="text-[10px] uppercase tracking-[0.18rem] text-slate-300">
            {currentCategoryLabel}
          </span>
          <span className="text-xs text-slate-200">
            {regionSelect === "__custom_region" ? customRegion || "Region" : regionSelect || "Global"}
          </span>
        </div>
      </div>
      <div className="mt-3 flex gap-3">
        {previewImageUrl && (
          <div className="flex w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black/30">
            <img
              src={previewImageUrl}
              alt={title || "Vorschau-Bild"}
              className="max-h-20 max-w-[6rem] object-contain"
            />
          </div>
        )}
        <div className="flex-1 space-y-1">
          <h3 className="text-base font-bold leading-snug text-white">
            {title || "Dein Fragetitel erscheint hier."}
          </h3>
          {description && <p className="text-xs text-slate-200 line-clamp-2">{description}</p>}
        </div>
      </div>
    </div>
  );

  return (
    <main
      className={`${isLeaving ? "page-leave" : "page-enter"} min-h-screen bg-slate-950 text-slate-50`}
    >
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-8 lg:max-w-5xl">
        <SmartBackButton
          fallbackHref="/"
          label="← Zurück"
          className="inline-flex items-center text-sm text-emerald-100 hover:text-emerald-200 bg-transparent p-0"
        />

        <section className="mt-4 rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl shadow-emerald-500/20 backdrop-blur">
          {loadingUser && (
            <p className="mb-4 text-sm text-slate-300">Prüfe Login-Status...</p>
          )}

          {!loadingUser && !currentUser && (
            <div className="mb-4 space-y-3 rounded-2xl border border-white/15 bg-black/40 p-4 text-sm text-slate-100">
              <p>
                Um eine Frage vorzuschlagen, musst du eingeloggt sein. Bitte melde dich an oder lege einen Account an.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => router.push("/auth")}
                  className="rounded-xl bg-emerald-500/80 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-500/40 transition hover:-translate-y-0.5 hover:bg-emerald-500"
                >
                  Zum Login / Register
                </button>
                <button
                  type="button"
                  onClick={() => navigateHome(false)}
                  className="rounded-xl border border-white/30 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-emerald-300/60"
                >
                  Zurück zum Feed
                </button>
              </div>
            </div>
          )}

          {!loadingUser && currentUser && currentUser.emailVerified === false && (
            <div className="mb-4 space-y-3 rounded-2xl border border-amber-300/60 bg-amber-500/15 p-4 text-sm text-amber-50">
              <p>
                Deine E-Mail-Adresse ist noch <span className="font-semibold">nicht bestätigt</span>. Bitte klicke auf
                den Link in der Verifikations-E-Mail. Erst nach der Bestätigung kannst du neue Fragen für den
                Review-Bereich einreichen.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={resendStatus === "sending"}
                  onClick={handleResendVerification}
                  className="rounded-xl bg-amber-500/80 px-4 py-2 text-xs font-semibold text-slate-900 shadow-md shadow-amber-500/40 transition hover:-translate-y-0.5 hover:bg-amber-400 disabled:cursor-wait disabled:opacity-80"
                >
                  {resendStatus === "sending" ? "Sende Link..." : "Verifikationslink erneut senden"}
                </button>
                <SmartBackButton
                  fallbackHref="/auth"
                  label="Zurück zur Anmeldung"
                  className="rounded-xl border border-amber-200/70 px-4 py-2 text-xs font-semibold text-amber-50 transition hover:-translate-y-0.5 hover:border-emerald-300/60"
                />
              </div>
              {resendMessage && (
                <p className="text-[11px] text-amber-100/90">
                  {resendMessage}
                </p>
              )}
            </div>
          )}
          <div className="sticky top-4 z-20 mb-4">
            <div className="space-y-3 rounded-2xl border border-white/20 bg-slate-950/95 p-4 shadow-xl shadow-emerald-500/25">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-white">Kachel-Vorschau</h2>
                <span className="text-[11px] text-slate-400">
                  So ungefähr wird deine Frage im Feed aussehen.
                </span>
              </div>
              {previewCard}
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white">Frage vorschlagen</h1>
          <p className="mt-1 text-sm text-slate-300">
            Formuliere eine neue Prognosefrage. Öffentlich geht sie erst in den Community-Review und danach in den Feed.
            Privat (nur per Link) ist sie nicht im Feed gelistet und wird direkt per Link abgestimmt.
          </p>

           {currentUser && currentUser.emailVerified !== false && (
             <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="mt-6 space-y-5">
             <div className="space-y-3 rounded-2xl border border-white/15 bg-black/20 p-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-100">Sichtbarkeit</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setVisibility("public")}
                    className={`inline-flex min-w-fit items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold shadow-sm shadow-black/20 transition hover:-translate-y-0.5 ${
                      visibility === "public"
                        ? "border-emerald-300/60 bg-emerald-500/20 text-white"
                        : "border-white/10 bg-white/5 text-slate-100 hover:border-emerald-200/40"
                    }`}
                  >
                    Öffentlich
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibility("link_only")}
                    className={`inline-flex min-w-fit items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold shadow-sm shadow-black/20 transition hover:-translate-y-0.5 ${
                      visibility === "link_only"
                        ? "border-emerald-300/60 bg-emerald-500/20 text-white"
                        : "border-white/10 bg-white/5 text-slate-100 hover:border-emerald-200/40"
                    }`}
                  >
                    Privat (nur per Link)
                  </button>
                </div>
                <p className="text-xs text-slate-400">
                  {visibility === "public"
                    ? "Öffentlich: erscheint (nach dem Review) im Feed. Alle können dann im Feed abstimmen."
                    : "Privat: nicht im Feed gelistet. Jeder mit dem Link kann direkt abstimmen."}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-100">Typ</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPollKind("prognose")}
                    className={`inline-flex min-w-fit items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold shadow-sm shadow-black/20 transition hover:-translate-y-0.5 ${
                      pollKind === "prognose"
                        ? "border-emerald-300/60 bg-emerald-500/20 text-white"
                        : "border-white/10 bg-white/5 text-slate-100 hover:border-emerald-200/40"
                    }`}
                  >
                    Prognose
                  </button>
                  <button
                    type="button"
                    onClick={() => setPollKind("meinung")}
                    className={`inline-flex min-w-fit items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold shadow-sm shadow-black/20 transition hover:-translate-y-0.5 ${
                      pollKind === "meinung"
                        ? "border-emerald-300/60 bg-emerald-500/20 text-white"
                        : "border-white/10 bg-white/5 text-slate-100 hover:border-emerald-200/40"
                    }`}
                  >
                    Meinungs-Umfrage
                  </button>
                </div>
                <p className="text-xs text-slate-400">
                  {pollKind === "prognose"
                    ? "Prognose: wird sp„ter aufgel”st (fr Punkte & Ranking)."
                    : "Meinungs-Umfrage: endet nur (ohne Aufl”sung & ohne Punkte)."}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-100">Antwortmodus</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setAnswerMode("binary")}
                    className={`inline-flex min-w-fit items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold shadow-sm shadow-black/20 transition hover:-translate-y-0.5 ${
                      answerMode === "binary"
                        ? "border-emerald-300/60 bg-emerald-500/20 text-white"
                        : "border-white/10 bg-white/5 text-slate-100 hover:border-emerald-200/40"
                    }`}
                  >
                    Ja/Nein
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnswerMode("options")}
                    className={`inline-flex min-w-fit items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold shadow-sm shadow-black/20 transition hover:-translate-y-0.5 ${
                      answerMode === "options"
                        ? "border-emerald-300/60 bg-emerald-500/20 text-white"
                        : "border-white/10 bg-white/5 text-slate-100 hover:border-emerald-200/40"
                    }`}
                  >
                    Optionen (2–6)
                  </button>
                </div>
                <p className="text-xs text-slate-400">
                  Nach dem Verffentlichen sind die Antwortoptionen fix und k”nnen nicht mehr ge„ndert werden.
                </p>
              </div>

              {answerMode === "options" ? (
                <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-white">Antwortoptionen</span>
                    <button
                      type="button"
                      onClick={() => setPollOptions((prev) => (prev.length >= 6 ? prev : [...prev, ""]))}
                      disabled={pollOptions.length >= 6}
                      className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-100 hover:border-emerald-200/40 disabled:opacity-50"
                    >
                      + Option
                    </button>
                  </div>
                  <div className="space-y-2">
                    {pollOptions.map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="w-5 text-xs font-semibold text-slate-300">{idx + 1}.</span>
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) =>
                            setPollOptions((prev) => prev.map((v, i) => (i === idx ? e.target.value : v)))
                          }
                          className="w-full rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 outline-none focus:border-emerald-300"
                          placeholder={idx === 0 ? "Option A" : idx === 1 ? "Option B" : `Option ${idx + 1}`}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setPollOptions((prev) => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== idx)))
                          }
                          disabled={pollOptions.length <= 2}
                          className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 hover:border-rose-200/40 disabled:opacity-50"
                          title="Option entfernen"
                        >
                          Entfernen
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400">
                    Mindestens 2, maximal 6. "Keine Ahnung/Enthaltung" kann einfach eine Option sein.
                  </p>
                </div>
              ) : null}
            </div>

            {isAdmin ? (
              <AdminAiAssistant
                isAdmin={isAdmin}
                onApply={applyAiSuggestion}
                requestedIsResolvable={pollKind === "prognose"}
                requestedAnswerMode={answerMode}
                requestedVisibility={visibility}
              />
            ) : null}

            <div className="space-y-3 rounded-2xl border border-white/15 bg-black/20 p-4">
              <div className="space-y-2">
                <label htmlFor="title" className="text-sm font-medium text-slate-100">
                  Titel der Frage
                </label>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 outline-none focus:border-emerald-300"
                  placeholder="Wird X bis Ende 2026 passieren?"
                />
                {vagueTitleHits.length > 0 ? (
                  <div className="rounded-xl border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-50/90">
                    <span className="font-semibold">Tipp:</span> Dein Titel wirkt etwas vage ({vagueTitleHits.join(", ")}).
                    {isPrivatePoll
                      ? " Formuliere messbar und eindeutig, damit am Ende klar ist, was „Ja“ bzw. „Nein“ bedeutet."
                      : " Formuliere messbar und eindeutig, damit die Auflösung später klar ist."}
                  </div>
                ) : null}

                {similarLoading ? (
                  <p className="text-xs text-slate-400">Suche nach ähnlichen Fragen...</p>
                ) : null}
                {similarError ? (
                  <p className="text-xs text-rose-300">{similarError}</p>
                ) : null}
                {!similarLoading && !similarError && similarMatches.length > 0 ? (
                  <div className="rounded-2xl border border-amber-300/30 bg-amber-500/10 p-3 text-xs text-amber-50/90">
                    <p className="mb-2 font-semibold text-amber-50">Achtung: Ähnliche Fragen gefunden</p>
                    <div className="space-y-2">
                      {similarMatches.map((m) => (
                        <div key={m.id} className="flex items-start justify-between gap-3">
                          <a
                            href={`/questions/${encodeURIComponent(m.id)}`}
                            className="min-w-0 flex-1 text-white hover:text-emerald-100"
                          >
                            <span className="block truncate font-semibold">{m.title}</span>
                            <span className="mt-0.5 block text-[11px] text-amber-100/80">
                              {m.ended ? "Beendet" : "Aktiv"} · Ähnlichkeit {m.score}%
                            </span>
                          </a>
                          <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-200">
                            {m.ended ? "Archiv" : "Feed"}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] text-amber-100/80">
                      Hinweis: Beendete Fragen zeigen nur, dass es das Thema schon gab. Du kannst trotzdem eine neue Frage
                      stellen, wenn Zeitraum/Details anders sind.
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-medium text-slate-100">
                  Beschreibung (optional)
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  className="w-full rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 outline-none focus:border-emerald-300"
                  placeholder="Erkläre kurz, worum es bei der Prognose geht. Dieser Text erscheint später nur in der Detailansicht."
                />
                <p className="text-xs text-slate-400">
                  Dieser Text dient dazu, das Thema genauer zu erklären. Er wird nicht in der Kachel im Feed angezeigt,
                  sondern in der Detailansicht der Frage.
                </p>
              </div>

              {!isPrivatePoll && isResolvable ? (
                <div className="space-y-2 pt-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-sm font-medium text-slate-100">Auflösung (echtes Ergebnis)</label>
                    <span className="rounded-full border border-emerald-300/40 bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-50">
                      Pflicht für öffentliche Fragen
                    </span>
                  </div>
                  <textarea
                    value={resolutionCriteria}
                    onChange={(e) => setResolutionCriteria(e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 outline-none focus:border-emerald-300"
                    placeholder={
                      answerMode === "options"
                        ? "Welche Option gilt als richtig? (klarer, prüfbarer Maßstab)"
                        : "Wann gilt Ja/Nein? (klarer, prüfbarer Maßstab)"
                    }
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="block text-xs text-slate-200">Quelle (Link oder Institution)</span>
                      <input
                        type="text"
                        value={resolutionSource}
                        onChange={(e) => setResolutionSource(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 outline-none focus:border-emerald-300"
                        placeholder="z.B. Bundeswahlleiter, Destatis oder URL"
                      />
                    </label>

                    <div className="space-y-1">
                      <span className="block text-xs text-slate-200">Auflösungs-Deadline</span>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          value={resolutionDeadlineDate}
                          min={minResolutionDate}
                          onChange={(e) => setResolutionDeadlineDate(e.target.value)}
                          className="w-full rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 outline-none focus:border-emerald-300"
                        />
                        <input
                          type="time"
                          value={resolutionDeadlineTime}
                          min={effectiveMinResolutionTime}
                          onChange={(e) => setResolutionDeadlineTime(e.target.value)}
                          className="w-full rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 outline-none focus:border-emerald-300"
                        />
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">
                    Hier legst du fest, wie das echte Ergebnis später entschieden wird (Ja/Nein) und wo man es nachprüfen kann.
                  </p>
                </div>
              ) : null}
            </div>

            <div className="space-y-3 rounded-2xl border border-white/15 bg-black/20 p-4">
              <div className="space-y-2">
                <label htmlFor="imageUrl" className="text-sm font-medium text-slate-100">
                  Bild (optional)
                </label>
                <input
                  id="imageUrl"
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  disabled={submitting}
                  className="w-full rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 outline-none focus:border-emerald-300"
                  placeholder="https://... (kleines Vorschaubild für die Kachel)"
                />
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    id="imageFile"
                    type="file"
                    accept="image/*"
                    disabled={submitting}
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setImageError(null);

                      if (imagePreviewUrl) {
                        URL.revokeObjectURL(imagePreviewUrl);
                      }

                      if (!file) {
                        setImageFile(null);
                        setImagePreviewUrl(null);
                        return;
                      }

                      const fileType = file.type || "";
                      if (!fileType.startsWith("image/") || fileType === "image/svg+xml") {
                        setImageFile(null);
                        setImagePreviewUrl(null);
                        setImageError("Bitte wähle eine gültige Bilddatei (z. B. JPG, PNG oder WebP).");
                        e.currentTarget.value = "";
                        return;
                      }

                      if (file.size > MAX_ORIGINAL_IMAGE_BYTES) {
                        setImageFile(null);
                        setImagePreviewUrl(null);
                        setImageError("Die Datei ist zu groß (max. 20 MB). Bitte wähle ein kleineres Bild.");
                        e.currentTarget.value = "";
                        return;
                      }

                      setImageFile(file);
                      const url = URL.createObjectURL(file);
                      setImagePreviewUrl(url);
                    }}
                    className="block w-full text-xs text-slate-200 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-100 hover:file:bg-slate-700"
                  />
                  {imageFile && previewImageUrl && (
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <div className="flex h-16 w-24 items-center justify-center overflow-hidden rounded-md bg-black/40">
                        <img
                          src={previewImageUrl}
                          alt={title || "Vorschau-Bild"}
                          className="max-h-16 max-w-[6rem] object-contain"
                        />
                      </div>
                      <span>Wird auf maximal ca. 250x150 Pixel verkleinert (Seitenverhältnis bleibt erhalten).</span>
                    </div>
                  )}
                </div>

                <AdminAiImageGenerator
                  isAdmin={isAdmin}
                  title={title}
                  description={description}
                  imagePrompt={aiImagePrompt}
                  disabled={submitting || imageUploadPhase !== "idle"}
                  onAdoptImageFile={adoptAiImageFile}
                />

                {imageError && <p className="text-xs text-rose-300">{imageError}</p>}

                {imageUploadPhase !== "idle" && (
                  <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/25 border-t-white/80" />
                        {imageUploadPhase === "resizing" ? "Bild wird vorbereitet..." : "Bild wird hochgeladen..."}
                      </span>
                      {imageUploadPhase === "uploading" && <span>{imageUploadProgress}%</span>}
                    </div>
                    {imageUploadPhase === "uploading" && (
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/30">
                        <div
                          className="h-full rounded-full bg-emerald-400/80 transition-[width]"
                          style={{ width: `${imageUploadProgress}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}

                <p className="text-xs text-slate-400">
                  Bitte lade nur Bilder hoch, an denen du die erforderlichen Nutzungsrechte besitzt (z.&nbsp;B. eigene
                  Fotos oder lizenzierte Grafiken). Mit dem Upload bestätigst du, dass keine Urheberrechte verletzt
                  werden und dass du für eventuelle Verstöße selbst verantwortlich bist.
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="imageCredit" className="text-sm font-medium text-slate-100">
                  Bildquelle / Urheberangabe (optional)
                </label>
                <input
                  id="imageCredit"
                  type="text"
                  value={imageCredit}
                  onChange={(e) => setImageCredit(e.target.value)}
                  maxLength={140}
                  className="w-full rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 outline-none focus:border-emerald-300"
                  placeholder='z. B. "Foto: Name / Agentur"'
                />
                <p className="text-xs text-slate-400">
                  Diese Angabe erscheint klein unter der Frage (z.&nbsp;B. in der Kachel und in der Detailansicht),
                  damit die Bildquelle klar erkennbar ist.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="category" className="text-sm font-medium text-slate-100">
                Kategorie
              </label>
              <select
                id="category"
                value={useCustomCategory ? "__custom" : category}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "__custom") {
                    setUseCustomCategory(true);
                    setCategory(categories[0]?.label ?? "");
                  } else {
                    setUseCustomCategory(false);
                    setCategory(value);
                  }
                }}
                className="w-full rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 outline-none focus:border-emerald-300"
              >
                {categories.map((cat) => (
                  <option key={cat.label} value={cat.label}>
                    {cat.label}
                  </option>
                ))}
                <option value="__custom">Eigene Kategorie eingeben ...</option>
              </select>
              {useCustomCategory && (
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 outline-none focus:border-emerald-300"
                  placeholder="z. B. Gesundheit, Bildung, Energie ..."
                />
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="region" className="text-sm font-medium text-slate-100">
                Region (optional)
              </label>
              <select
                id="region"
                value={regionSelect}
                onChange={(e) => setRegionSelect(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 outline-none focus:border-emerald-300"
              >
                <option value="Global">Alle / Global</option>
                <option value="Deutschland">Deutschland</option>
                <option value="Europa">Europa</option>
                <option value="DACH">DACH (Deutschland, Österreich, Schweiz)</option>
                <option value="__custom_region">Stadt oder Region frei eingeben</option>
              </select>
              {regionSelect === "__custom_region" && (
                <input
                  type="text"
                  value={customRegion}
                  onChange={(e) => setCustomRegion(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 outline-none focus:border-emerald-300"
                  placeholder="z. B. Berlin, NRW, Bodensee-Region"
                />
              )}
              <p className="text-xs text-slate-400">
                Du kannst hier wählen, für welche Region deine Prognose gedacht ist. Wenn du nichts änderst, gilt die
                Frage global.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-100">
                {isPrivatePoll ? "Abstimmung endet am" : "Review-Zeitraum (Community-Review)"}
              </label>

              {!isPrivatePoll ? (
                <div className="mt-2 space-y-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-black/20">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white">Dauer (Stunden)</div>
                      <p className="mt-0.5 text-xs text-slate-300">
                        Wie lange die Community Zeit hat, deine Frage im Review-Bereich zu bewerten. Standard: 72 Stunden.
                      </p>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                          {[
                            { label: "24h", hours: 24, hint: "1 Tag" },
                            { label: "48h", hours: 48, hint: "2 Tage" },
                            { label: "72h", hours: 72, hint: "3 Tage" },
                            { label: "168h", hours: 168, hint: "7 Tage" },
                            { label: "336h", hours: 336, hint: "14 Tage" },
                          ].map((preset) => (
                            <button
                              key={preset.hours}
                              type="button"
                              onClick={() => setTimeLeftHours(preset.hours)}
                              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition hover:-translate-y-0.5 ${
                                timeLeftHours === preset.hours
                                  ? "border-emerald-300/60 bg-emerald-500/20 text-white"
                                  : "border-white/15 bg-white/5 text-slate-100 hover:border-emerald-200/30"
                              }`}
                            >
                              <span>{preset.label}</span>
                              <span className="text-[11px] text-slate-300/90">{preset.hint}</span>
                            </button>
                          ))}
                    </div>

                    <div className="mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setTimeLeftHours((prev) => Math.max(1, Math.round((prev || 72) - 1)))}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white transition hover:-translate-y-0.5 hover:border-emerald-200/30"
                            aria-label="Eine Stunde weniger"
                          >
                            -
                          </button>
                          <input
                            id="timeLeft"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={String(timeLeftHours)}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^\d]/g, "");
                              const parsed = raw ? Number.parseInt(raw, 10) : 0;
                              const clamped = Math.min(24 * 365, Math.max(1, Number.isFinite(parsed) ? parsed : 72));
                              setTimeLeftHours(clamped);
                            }}
                            className="h-10 w-full rounded-xl border border-white/15 bg-slate-900/60 px-3 text-sm text-white shadow-inner shadow-black/40 outline-none focus:border-emerald-300"
                          />
                          <button
                            type="button"
                            onClick={() => setTimeLeftHours((prev) => Math.min(24 * 365, Math.round((prev || 72) + 1)))}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white transition hover:-translate-y-0.5 hover:border-emerald-200/30"
                            aria-label="Eine Stunde mehr"
                          >
                            +
                          </button>
                    </div>

                    <p className="mt-2 text-xs text-slate-400">Tipp: Wenn du unsicher bist, nimm 72 Stunden.</p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-black/20">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-white">Abstimmung endet am (optional)</div>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-200">
                        Standard: 14 Tage
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-300">
                      Setze einen konkreten Endzeitpunkt für die Ja/Nein-Abstimmung im Feed. Wenn du nichts angibst,
                      endet die Abstimmung standardmäßig 14 Tage nach Veröffentlichung im Feed.
                    </p>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label htmlFor="endDate" className="text-xs font-medium text-slate-200">
                          Datum
                        </label>
                        <input
                          id="endDate"
                          type="date"
                          value={endDate}
                          min={minEndDate}
                          onChange={(e) => {
                            const nextDate = e.target.value;
                            setEndDate(nextDate);
                            const nextMinTime = getMinTimeStringForDate(nextDate || minEndDate);
                            if (!endTime || endTime < nextMinTime) {
                              setEndTime(nextMinTime);
                            }
                          }}
                          className="w-full rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 outline-none focus:border-emerald-300"
                        />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="endTime" className="text-xs font-medium text-slate-200">
                          Uhrzeit
                        </label>
                        <input
                          id="endTime"
                          type="time"
                          value={endTime}
                          min={getMinTimeStringForDate(endDate || minEndDate)}
                          step={60}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="w-full rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 outline-none focus:border-emerald-300"
                        />
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400">
                    Wichtig: Abstimmungsende ist nicht die spätere „Auflösung“ (echtes Ergebnis mit Quelle).
                  </p>
                </div>
              ) : null}

              {isPrivatePoll ? (
                <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-black/20">
                  <div className="text-sm font-semibold text-white">Endet am (Datum + Uhrzeit)</div>
                  <p className="mt-1 text-xs text-slate-300">
                    Bis dahin können alle mit dem Link abstimmen. Danach ist die private Umfrage geschlossen.
                  </p>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label htmlFor="endDate" className="text-xs font-medium text-slate-200">
                        Datum
                      </label>
                      <input
                        id="endDate"
                        type="date"
                        value={endDate}
                        min={minEndDate}
                        onChange={(e) => {
                          const nextDate = e.target.value;
                          setEndDate(nextDate);
                          const nextMinTime = getMinTimeStringForDate(nextDate || minEndDate);
                          if (!endTime || endTime < nextMinTime) {
                            setEndTime(nextMinTime);
                          }
                        }}
                        className="w-full rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 outline-none focus:border-emerald-300"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="endTime" className="text-xs font-medium text-slate-200">
                        Uhrzeit
                      </label>
                      <input
                        id="endTime"
                        type="time"
                        value={endTime}
                        min={getMinTimeStringForDate(endDate || minEndDate)}
                        step={60}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 outline-none focus:border-emerald-300"
                      />
                    </div>
                  </div>

                  <p className="mt-2 text-xs text-slate-400">
                    Hinweis: Das ist nur das Ende der Abstimmung - keine spätere „Auflösung“ mit Quelle wie bei öffentlichen Fragen.
                  </p>
                </div>
              ) : null}
            </div>

            {error && <p className="text-sm text-rose-300">{error}</p>}

            <div className="mt-6 flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-emerald-500/80 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:-translate-y-0.5 hover:bg-emerald-500 disabled:cursor-wait disabled:opacity-80"
              >
                {submitting ? "Bitte warten..." : "Frage einreichen"}
              </button>
              <button
                type="button"
                onClick={() => navigateHome(false)}
                className="rounded-xl border border-white/25 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-emerald-300/60"
              >
                Abbrechen
              </button>
            </div>
          </form>
          )}
        </section>
      </div>
    </main>
  );
}
