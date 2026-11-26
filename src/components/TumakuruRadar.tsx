import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, PhoneCall, Navigation, Bus, Footprints, Clock } from 'lucide-react';
import { Job, Worker } from '../services/jobService';
import { SupportedLang } from '../services/voiceService';

interface TumakuruRadarProps {
  mode: 'jobs' | 'workers';
  jobs?: Job[];
  workers?: Worker[];
  lang: SupportedLang;
  radiusKm: 5 | 10;
  selectedId?: string | null;
  onSelectId?: (id: string) => void;
  onRadiusChange: (r: 5 | 10) => void;
  onSelectJobAction?: (job: Job) => void;
  onSelectWorkerCall?: (worker: Worker) => void;
  heightClass?: string;
}

const TUMAKURU_CENTER: [number, number] = [13.3392, 77.1140];

export default function TumakuruRadar({
  mode,
  jobs = [],
  workers = [],
  lang,
  radiusKm,
  selectedId: controlledId,
  onSelectId,
  onRadiusChange,
  onSelectJobAction,
  onSelectWorkerCall,
  heightClass = 'h-72 sm:h-80',
}: TumakuruRadarProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  const visibleJobs = jobs.filter((j) => j.distanceKm <= radiusKm);
  const visibleWorkers = workers.filter((w) => w.distanceKm <= radiusKm);

  const [internalId, setInternalId] = useState<string | null>(
    mode === 'jobs' ? visibleJobs[0]?.id ?? null : visibleWorkers[0]?.id ?? null
  );

  const activeId = controlledId !== undefined ? controlledId : internalId;
  const setSelected = (id: string) => {
    if (onSelectId) onSelectId(id);
    else setInternalId(id);
  };

  const selectedJob = visibleJobs.find((j) => j.id === activeId) ?? visibleJobs[0];
  const selectedWorker = visibleWorkers.find((w) => w.id === activeId) ?? visibleWorkers[0];

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: TUMAKURU_CENTER,
      zoom: 13,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const group = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    layerGroupRef.current = group;

    const timer = setTimeout(() => map.invalidateSize(), 150);
    return () => {
      clearTimeout(timer);
      map.remove();
      mapInstanceRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    L.circle(TUMAKURU_CENTER, {
      radius: radiusKm * 1000,
      color: '#EA580C',
      weight: 1.5,
      dashArray: '5 5',
      fillColor: '#F59E0B',
      fillOpacity: 0.06,
    }).addTo(group);

    const centerIcon = L.divIcon({
      className: 'kelsa-center-pin',
      html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-50%);">
        <div style="width:12px;height:12px;border-radius:9999px;background:#2563EB;border:2.5px solid #FFFFFF;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>
        <span style="margin-top:3px;background:#14171A;color:#FFFFFF;font-size:10px;font-weight:700;padding:2px 6px;border-radius:6px;white-space:nowrap;">City Center</span>
      </div>`,
      iconSize: [0, 0],
    });
    L.marker(TUMAKURU_CENTER, { icon: centerIcon, interactive: false }).addTo(group);

    if (mode === 'jobs') {
      visibleJobs.forEach((job) => {
        const isSelected = selectedJob?.id === job.id;
        const pinIcon = L.divIcon({
          className: 'kelsa-job-pin',
          html: `<div style="transform:translate(-50%,-50%);cursor:pointer;display:inline-flex;align-items:center;padding:4px 9px;border-radius:10px;font-family:'Plus Jakarta Sans',sans-serif;font-size:11.5px;font-weight:800;white-space:nowrap;border:2px solid ${
            isSelected ? '#14171A' : '#FFFFFF'
          };background:${isSelected ? '#F59E0B' : '#14171A'};color:${
            isSelected ? '#14171A' : '#FFFFFF'
          };box-shadow:0 4px 10px rgba(0,0,0,0.28);">
            ₹${job.wage}
          </div>`,
          iconSize: [0, 0],
        });

        const marker = L.marker(job.latLng, { icon: pinIcon, zIndexOffset: isSelected ? 500 : 0 }).addTo(group);
        marker.on('click', () => {
          setSelected(job.id);
          map.panTo(job.latLng, { animate: true });
        });
      });
    } else {
      visibleWorkers.forEach((worker) => {
        const isSelected = selectedWorker?.id === worker.id;
        const pinIcon = L.divIcon({
          className: 'kelsa-worker-pin',
          html: `<div style="transform:translate(-50%,-50%);cursor:pointer;display:inline-flex;align-items:center;padding:4px 9px;border-radius:10px;font-family:'Plus Jakarta Sans',sans-serif;font-size:11px;font-weight:800;white-space:nowrap;border:2px solid ${
            isSelected ? '#14171A' : '#FFFFFF'
          };background:${isSelected ? '#10B981' : '#14171A'};color:${
            isSelected ? '#14171A' : '#FFFFFF'
          };box-shadow:0 4px 10px rgba(0,0,0,0.28);">
            ${worker.name.split(' ')[0]} · ₹${worker.wageExpected}
          </div>`,
          iconSize: [0, 0],
        });

        const marker = L.marker(worker.latLng, { icon: pinIcon, zIndexOffset: isSelected ? 500 : 0 }).addTo(group);
        marker.on('click', () => {
          setSelected(worker.id);
          map.panTo(worker.latLng, { animate: true });
        });
      });
    }
  }, [mode, radiusKm, visibleJobs, visibleWorkers, selectedJob?.id, selectedWorker?.id]);

  // Smooth pan when parent changes selectedId or radiusKm changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (mode === 'jobs' && selectedJob && controlledId) {
      map.panTo(selectedJob.latLng, { animate: true });
    }
  }, [controlledId, mode]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.setView(TUMAKURU_CENTER, radiusKm === 10 ? 11 : 13, { animate: true });
  }, [radiusKm]);

  return (
    <div className="bg-white rounded-3xl border border-stone-200/90 shadow-sm overflow-hidden">
      {/* Map Header Bar */}
      <div className="px-5 py-3.5 border-b border-stone-100 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold text-[#14171A]">
            {lang === 'kn' ? 'ನೇರ ನಕ್ಷೆ' : lang === 'hi' ? 'लाइव मानचित्र' : 'Live Area Map'}
          </h3>
          <p className="text-[11px] text-stone-500">
            {mode === 'jobs'
              ? `${visibleJobs.length} shifts within ${radiusKm} km`
              : `${visibleWorkers.length} available workers within ${radiusKm} km`}
          </p>
        </div>

        <div className="flex items-center bg-stone-100 p-1 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => onRadiusChange(5)}
            className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap cursor-pointer ${
              radiusKm === 5 ? 'bg-white text-[#14171A] shadow-sm' : 'text-stone-600 hover:text-[#14171A]'
            }`}
          >
            5 km
          </button>
          <button
            type="button"
            onClick={() => onRadiusChange(10)}
            className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap cursor-pointer ${
              radiusKm === 10 ? 'bg-white text-[#14171A] shadow-sm' : 'text-stone-600 hover:text-[#14171A]'
            }`}
          >
            10 km
          </button>
        </div>
      </div>

      {/* Leaflet + OpenStreetMap Viewport */}
      <div className={`relative w-full ${heightClass} z-0`}>
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>

      {/* Synced Bottom Shift/Worker Preview */}
      {mode === 'jobs' && selectedJob && (
        <div className="p-4 bg-[#FAF8F5] border-t border-stone-200/80 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#2563EB] truncate">{selectedJob.employer}</p>
              <h4 className="text-sm font-extrabold text-[#14171A] leading-snug mt-0.5">
                {lang === 'kn'
                  ? selectedJob.titleKannada
                  : lang === 'hi'
                  ? selectedJob.titleHindi
                  : selectedJob.titleEnglish}
              </h4>
            </div>
            <div className="text-right shrink-0">
              <span className="text-base font-extrabold text-[#059669] tabular-nums">₹{selectedJob.wage}</span>
              <span className="block text-[10px] font-semibold text-stone-500">{selectedJob.paymentMode}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-stone-600">
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-[#EA580C]" />
              {selectedJob.location} ({selectedJob.distanceKm} km)
            </span>
            <span className="inline-flex items-center gap-1">
              {selectedJob.distanceKm <= 1.5 ? <Footprints className="w-3.5 h-3.5" /> : <Bus className="w-3.5 h-3.5" />}
              {selectedJob.commuteNote}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-stone-400" />
              {selectedJob.shiftTime}
            </span>
          </div>

          <button
            type="button"
            onClick={() => onSelectJobAction && onSelectJobAction(selectedJob)}
            className="w-full min-h-[42px] bg-[#F59E0B] hover:bg-[#EA580C] hover:text-white text-[#14171A] font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>{lang === 'kn' ? 'ಶಿಫ್ಟ್ ಒಪ್ಪಿಕೊಳ್ಳಿ / ಕರೆ ಮಾಡಿ' : 'Accept Shift / Call Owner'}</span>
          </button>
        </div>
      )}

      {mode === 'workers' && selectedWorker && (
        <div className="p-4 bg-[#FAF8F5] border-t border-stone-200/80 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold text-[#059669]">
              {selectedWorker.rating} ★ · {selectedWorker.gigsCompleted} gigs · {selectedWorker.distanceKm} km
            </p>
            <h4 className="text-sm font-extrabold text-[#14171A] truncate">
              {lang === 'kn' ? selectedWorker.nameKannada : selectedWorker.name} —{' '}
              {lang === 'kn' ? selectedWorker.skillKannada : selectedWorker.skillEnglish}
            </h4>
          </div>

          <button
            type="button"
            onClick={() => onSelectWorkerCall && onSelectWorkerCall(selectedWorker)}
            className="min-h-[42px] px-4 bg-[#14171A] hover:bg-stone-800 text-white font-extrabold text-xs rounded-xl inline-flex items-center gap-1.5 shrink-0 transition cursor-pointer"
          >
            <Navigation className="w-3.5 h-3.5 text-amber-400" />
            <span>Call ₹{selectedWorker.wageExpected}</span>
          </button>
        </div>
      )}
    </div>
  );
}
