import { getEvents } from "@/lib/services/event.service";
import { format } from "date-fns";
import Link from "next/link";
export const metadata = { title: "Archive" };

export default async function ArchivePage() {
  const events = await getEvents({ archived: true, limit: 100 });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Archive</h1>
        <p className="text-slate-400 mt-1">Past NexCell events</p>
      </div>
      {events.length === 0 ? (
        <div className="text-center py-20 text-slate-500">No past events yet</div>
      ) : (
        <div className="space-y-3">
          {events.map((event: any) => (
            <Link key={event.id} href={`/events/${event.id}`}>
              <div className="glass-card-hover p-4 flex items-center gap-4 cursor-pointer">
                <div className="w-12 h-12 rounded-xl bg-navy-800 flex flex-col items-center justify-center flex-shrink-0 border border-navy-700">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">{format(new Date(event.eventDate), "MMM")}</span>
                  <span className="text-lg font-bold text-white leading-none">{format(new Date(event.eventDate), "d")}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white truncate">{event.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{format(new Date(event.eventDate), "yyyy")} · {Number(event.registrationCount ?? 0)} participants</p>
                </div>
                <span className={event.type === "free" ? "badge-green" : "badge-cyan"}>
                  {event.type === "free" ? "Free" : `₥${event.priceMb?.toLocaleString()}`}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
