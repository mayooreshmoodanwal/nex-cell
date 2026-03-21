"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Calendar, MapPin, Users, DollarSign, Image as ImageIcon,
  Tag, FileText, Loader2, ArrowLeft, Sparkles, Upload, X,
} from "lucide-react";
import { toast } from "sonner";

interface FormData {
  title: string;
  description: string;
  shortDescription: string;
  eventDate: string;
  registrationDeadline: string;
  type: "free" | "paid_mb";
  priceMb: string;
  maxParticipants: string;
  imageUrl: string;
  venue: string;
  tags: string;
}

const INITIAL: FormData = {
  title: "",
  description: "",
  shortDescription: "",
  eventDate: "",
  registrationDeadline: "",
  type: "free",
  priceMb: "",
  maxParticipants: "",
  imageUrl: "",
  venue: "",
  tags: "",
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.35, ease: "easeOut" },
  }),
};

export default function CreateEventForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const csrf = () =>
    document.cookie
      .split(";")
      .find((c) => c.trim().startsWith("csrf_token="))
      ?.split("=")[1];

  const set = (key: keyof FormData, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => {
      const copy = { ...e };
      delete copy[key];
      return copy;
    });
  };

  /* ── Image upload ─────────────────────────────── */
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }

    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", "events");

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: csrf() ? { "x-csrf-token": csrf()! } : {},
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Upload failed");
      } else {
        set("imageUrl", data.data.url);
        toast.success("Image uploaded!");
      }
    } catch {
      toast.error("Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  };

  /* ── Client-side validation ───────────────────── */
  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (form.title.trim().length < 3) errs.title = "Title must be at least 3 characters";
    if (form.description.trim().length < 10) errs.description = "Description must be at least 10 characters";
    if (!form.eventDate) errs.eventDate = "Event date is required";
    if (!form.registrationDeadline) errs.registrationDeadline = "Registration deadline is required";

    if (form.eventDate && form.registrationDeadline) {
      if (new Date(form.eventDate) <= new Date(form.registrationDeadline)) {
        errs.eventDate = "Event date must be after registration deadline";
      }
    }

    if (form.type === "paid_mb") {
      const price = Number(form.priceMb);
      if (!form.priceMb || isNaN(price) || price <= 0) {
        errs.priceMb = "Price is required for paid events";
      }
    }

    if (form.maxParticipants) {
      const mp = Number(form.maxParticipants);
      if (isNaN(mp) || mp <= 0 || !Number.isInteger(mp)) {
        errs.maxParticipants = "Must be a positive whole number";
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /* ── Submit ───────────────────────────────────── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);

    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      description: form.description.trim(),
      eventDate: new Date(form.eventDate).toISOString(),
      registrationDeadline: new Date(form.registrationDeadline).toISOString(),
      type: form.type,
    };

    if (form.shortDescription.trim()) payload.shortDescription = form.shortDescription.trim();
    if (form.type === "paid_mb") payload.priceMb = Number(form.priceMb);
    if (form.maxParticipants) payload.maxParticipants = Number(form.maxParticipants);
    if (form.imageUrl) payload.imageUrl = form.imageUrl;
    if (form.venue.trim()) payload.venue = form.venue.trim();
    if (form.tags.trim()) {
      payload.tags = form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 10);
    }

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrf() ? { "x-csrf-token": csrf()! } : {}),
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.fields) {
          const fieldErrors: Record<string, string> = {};
          data.fields.forEach((f: { path: string; message: string }) => {
            fieldErrors[f.path] = f.message;
          });
          setErrors(fieldErrors);
        }
        toast.error(data.error ?? "Failed to create event");
      } else {
        toast.success("Event created successfully! 🎉");
        router.push(`/events/${data.data.id}`);
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Field helper ─────────────────────────────── */
  const Field = ({
    label,
    icon: Icon,
    error,
    children,
  }: {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    error?: string;
    children: React.ReactNode;
  }) => (
    <div>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
        <Icon className="w-4 h-4 text-cyan-400" />
        {label}
      </label>
      {children}
      {error && (
        <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
          <span className="inline-block w-1 h-1 rounded-full bg-red-400" />
          {error}
        </p>
      )}
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <motion.div custom={0} initial="hidden" animate="visible" variants={fadeUp}>
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
            <Sparkles className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="page-title">Create Event</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              Fill in the details below to publish a new event
            </p>
          </div>
        </div>
      </motion.div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Basic info ─────────────────────────────── */}
        <motion.div custom={1} initial="hidden" animate="visible" variants={fadeUp}>
          <div className="glass-card p-6 space-y-5">
            <p className="section-label">Basic information</p>

            <Field label="Event title" icon={FileText} error={errors.title}>
              <input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="e.g. NexCell Tech Meetup 2026"
                className="input-dark"
                maxLength={200}
              />
            </Field>

            <Field label="Short description" icon={FileText} error={errors.shortDescription}>
              <input
                value={form.shortDescription}
                onChange={(e) => set("shortDescription", e.target.value)}
                placeholder="A brief one-liner (optional)"
                className="input-dark"
                maxLength={300}
              />
            </Field>

            <Field label="Full description" icon={FileText} error={errors.description}>
              <textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Describe your event in detail — agenda, what to expect, etc."
                className="input-dark min-h-[120px] resize-y"
                maxLength={5000}
                rows={5}
              />
            </Field>
          </div>
        </motion.div>

        {/* ── Date & Venue ───────────────────────────── */}
        <motion.div custom={2} initial="hidden" animate="visible" variants={fadeUp}>
          <div className="glass-card p-6 space-y-5">
            <p className="section-label">Date &amp; venue</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="Event date & time" icon={Calendar} error={errors.eventDate}>
                <input
                  type="datetime-local"
                  value={form.eventDate}
                  onChange={(e) => set("eventDate", e.target.value)}
                  className="input-dark"
                />
              </Field>

              <Field label="Registration deadline" icon={Calendar} error={errors.registrationDeadline}>
                <input
                  type="datetime-local"
                  value={form.registrationDeadline}
                  onChange={(e) => set("registrationDeadline", e.target.value)}
                  className="input-dark"
                />
              </Field>
            </div>

            <Field label="Venue" icon={MapPin} error={errors.venue}>
              <input
                value={form.venue}
                onChange={(e) => set("venue", e.target.value)}
                placeholder="e.g. Room 301, Block A (optional)"
                className="input-dark"
                maxLength={200}
              />
            </Field>
          </div>
        </motion.div>

        {/* ── Type & Pricing ─────────────────────────── */}
        <motion.div custom={3} initial="hidden" animate="visible" variants={fadeUp}>
          <div className="glass-card p-6 space-y-5">
            <p className="section-label">Type &amp; pricing</p>

            <div className="flex gap-3">
              {(["free", "paid_mb"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set("type", t)}
                  className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium border transition-all duration-200 ${
                    form.type === t
                      ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30"
                      : "bg-navy-800/60 text-slate-400 border-navy-700 hover:text-white hover:border-navy-600"
                  }`}
                >
                  {t === "free" ? "🎉 Free event" : "💰 Paid (Mirai Bucks)"}
                </button>
              ))}
            </div>

            {form.type === "paid_mb" && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                <Field label="Price (₥ Mirai Bucks)" icon={DollarSign} error={errors.priceMb}>
                  <input
                    type="number"
                    value={form.priceMb}
                    onChange={(e) => set("priceMb", e.target.value)}
                    placeholder="e.g. 500"
                    className="input-dark"
                    min={1}
                  />
                </Field>
              </motion.div>
            )}

            <Field label="Max participants" icon={Users} error={errors.maxParticipants}>
              <input
                type="number"
                value={form.maxParticipants}
                onChange={(e) => set("maxParticipants", e.target.value)}
                placeholder="Leave empty for unlimited"
                className="input-dark"
                min={1}
              />
            </Field>
          </div>
        </motion.div>

        {/* ── Image & Tags ───────────────────────────── */}
        <motion.div custom={4} initial="hidden" animate="visible" variants={fadeUp}>
          <div className="glass-card p-6 space-y-5">
            <p className="section-label">Media &amp; tags</p>

            {/* Image upload */}
            <Field label="Cover image" icon={ImageIcon} error={errors.imageUrl}>
              {form.imageUrl ? (
                <div className="relative rounded-xl overflow-hidden h-48 group">
                  <img
                    src={form.imageUrl}
                    alt="Event cover"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => set("imageUrl", "")}
                      className="p-2 rounded-full bg-red-500/80 text-white hover:bg-red-500 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full h-40 rounded-xl border-2 border-dashed border-navy-600 hover:border-cyan-500/40 transition-colors flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-slate-300"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                      <span className="text-sm">Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-6 h-6" />
                      <span className="text-sm">Click to upload cover image</span>
                      <span className="text-xs text-slate-600">JPEG, PNG, WebP, GIF · Max 5 MB</span>
                    </>
                  )}
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleImageUpload}
                className="hidden"
              />
            </Field>

            <Field label="Tags" icon={Tag} error={errors.tags}>
              <input
                value={form.tags}
                onChange={(e) => set("tags", e.target.value)}
                placeholder="tech, workshop, networking (comma separated, optional)"
                className="input-dark"
              />
            </Field>
          </div>
        </motion.div>

        {/* ── Submit ──────────────────────────────────── */}
        <motion.div custom={5} initial="hidden" animate="visible" variants={fadeUp}>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="btn-neon flex-1 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating event...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Create Event
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="btn-ghost"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </form>
    </div>
  );
}
