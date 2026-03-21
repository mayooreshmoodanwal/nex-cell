"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Calendar, MapPin, Users, Heart, ArrowRight, Search, Zap, Plus } from "lucide-react";
import { format } from "date-fns";

const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05 } }) };

export default function EventsClient({ events, canCreate = false }: { events: any[]; canCreate?: boolean }) {
  const [filter, setFilter] = useState<"all" | "free" | "paid_mb">("all");
  const [search, setSearch] = useState("");

  const filtered = events.filter(e => {
    const matchType = filter === "all" || e.type === filter;
    const matchSearch = !search || e.title.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Events</h1>
          <p className="text-slate-400 mt-1">Discover and register for upcoming NexCell events</p>
        </div>
        {canCreate && (
          <Link href="/events/create" className="btn-neon flex-shrink-0 self-start sm:self-auto">
            <Plus className="w-4 h-4" /> Create Event
          </Link>
        )}
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search events..."
            className="input-dark pl-10" />
        </div>
        <div className="flex gap-2">
          {(["all", "free", "paid_mb"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filter === f ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "bg-navy-800 text-slate-400 hover:text-white border border-navy-700"}`}>
              {f === "all" ? "All" : f === "free" ? "Free" : "Paid"}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Events grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <Calendar className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400">No events found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((event, i) => (
            <motion.div key={event.id} custom={i} initial="hidden" animate="visible" variants={fadeUp}>
              <Link href={`/events/${event.id}`}>
                <div className="glass-card-hover overflow-hidden cursor-pointer h-full flex flex-col">
                  {/* Image */}
                  <div className="h-40 bg-gradient-to-br from-navy-800 to-navy-900 relative overflow-hidden flex-shrink-0">
                    {event.imageUrl ? (
                      <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Zap className="w-10 h-10 text-navy-700" />
                      </div>
                    )}
                    <div className="absolute top-3 left-3">
                      {event.type === "free"
                        ? <span className="badge-green">Free</span>
                        : <span className="badge-cyan">₥{event.priceMb?.toLocaleString()}</span>}
                    </div>
                    {event.isRegistered && (
                      <div className="absolute top-3 right-3">
                        <span className="badge-purple">Registered</span>
                      </div>
                    )}
                  </div>
                  {/* Content */}
                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="font-semibold text-white mb-1 line-clamp-2 leading-snug">{event.title}</h3>
                    {event.shortDescription && (
                      <p className="text-xs text-slate-500 line-clamp-2 mb-3">{event.shortDescription}</p>
                    )}
                    <div className="space-y-1.5 mt-auto">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Calendar className="w-3.5 h-3.5 text-cyan-500 flex-shrink-0" />
                        {format(new Date(event.eventDate), "EEE, dd MMM yyyy")}
                      </div>
                      {event.venue && (
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <MapPin className="w-3.5 h-3.5 text-cyan-500 flex-shrink-0" />
                          {event.venue}
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-2 border-t border-navy-700 mt-2">
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1"><Users className="w-3 h-3" />{Number(event.registrationCount ?? 0)}</span>
                          <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{Number(event.likeCount ?? 0)}</span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-600" />
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
