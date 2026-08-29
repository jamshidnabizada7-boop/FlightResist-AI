'use client';

import React, { useState, useEffect } from 'react';
import {
  Plane,
  Building2,
  Calendar,
  Clock,
  User,
  Shield,
  Briefcase,
  Luggage,
  Sparkles,
  Upload,
  Download,
  Plus,
  Trash2,
  Check,
  RotateCcw,
  ArrowRight,
  FileCode,
  Globe2,
  Layers,
  Copy,
  AlertCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import type { Itinerary, FlightLeg, PresetSummary } from '@/lib/flightresist/types';
import { getAirportName, getAirportCity } from '@/lib/flightresist/airports-data';
import { getAirlineName } from '@/lib/flightresist/airlines-data';

interface ItineraryStudioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentItinerary: Itinerary;
  onItineraryUpdated: () => void;
}

export function ItineraryStudioModal({
  open,
  onOpenChange,
  currentItinerary,
  onItineraryUpdated,
}: ItineraryStudioModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'presets' | 'custom' | 'import' | 'saved'>('presets');
  const [loading, setLoading] = useState(false);

  // Presets state
  const [presets, setPresets] = useState<PresetSummary[]>([]);

  // Custom Form Builder state
  const [origin, setOrigin] = useState(currentItinerary?.origin || 'SIN');
  const [destination, setDestination] = useState(currentItinerary?.destination || 'NRT');
  const [travelDate, setTravelDate] = useState(
    currentItinerary?.travelDateIso ? currentItinerary.travelDateIso.slice(0, 10) : '2026-08-27'
  );
  const [tripPurpose, setTripPurpose] = useState(
    currentItinerary?.tripPurpose || 'Contract signing — Global Partnership'
  );

  // Passenger state
  const [passengerName, setPassengerName] = useState(currentItinerary?.passenger?.name || 'Wei Chen');
  const [ticketRef, setTicketRef] = useState(currentItinerary?.passenger?.ticketReference || 'SQ-4471-XK2');
  const [loyaltyProgram, setLoyaltyProgram] = useState(
    currentItinerary?.passenger?.loyaltyProgram || 'Singapore Airlines KrisFlyer'
  );
  const [loyaltyTier, setLoyaltyTier] = useState(
    currentItinerary?.passenger?.loyaltyTier || 'KrisFlyer Elite Gold'
  );
  const [contactEmail, setContactEmail] = useState(
    currentItinerary?.passenger?.contactEmail || 'traveler@enterprise.com'
  );

  // Mission & Constraints state
  const [missionTitle, setMissionTitle] = useState(
    currentItinerary?.mission?.title || 'Contract signing — ¥2.1B infrastructure partnership'
  );
  const [missionVenue, setMissionVenue] = useState(
    currentItinerary?.mission?.venue || 'Marunouchi client HQ'
  );
  const [dealValue, setDealValue] = useState<string>(
    currentItinerary?.mission?.dealValue ? String(currentItinerary.mission.dealValue) : '2100000000'
  );
  const [budgetUsd, setBudgetUsd] = useState(currentItinerary?.constraints?.budgetUsd ?? 150);
  const [mctMin, setMctMin] = useState(currentItinerary?.constraints?.mctMin ?? 60);
  const [baggagePieces, setBaggagePieces] = useState(currentItinerary?.constraints?.baggagePieces ?? 1);
  const [baggageWeightKg, setBaggageWeightKg] = useState(currentItinerary?.constraints?.baggageWeightKg ?? 23);

  // Flight Legs state
  const [legs, setLegs] = useState<FlightLeg[]>(
    currentItinerary?.legs && currentItinerary.legs.length > 0
      ? currentItinerary.legs
      : [
          {
            flightNumber: 'SQ856',
            airlineCode: 'SQ',
            airlineName: 'Singapore Airlines',
            from: 'SIN',
            to: 'HKG',
            depIso: '2026-08-27T08:00:00+08:00',
            arrIso: '2026-08-27T12:05:00+08:00',
            durationMin: 245,
            aircraft: 'Airbus A350-900',
            cabin: 'Economy (Flexi)',
          },
          {
            flightNumber: 'CX520',
            airlineCode: 'CX',
            airlineName: 'Cathay Pacific',
            from: 'HKG',
            to: 'NRT',
            depIso: '2026-08-27T14:30:00+08:00',
            arrIso: '2026-08-27T19:45:00+09:00',
            durationMin: 255,
            aircraft: 'Boeing 777-300ER',
            cabin: 'Economy (Flexi)',
          },
        ]
  );

  // Import / Export state
  const [rawPnrText, setRawPnrText] = useState('');
  const [rawJsonText, setRawJsonText] = useState('');

  // Fetch presets on modal open
  useEffect(() => {
    if (!open) return;
    fetch('/api/itinerary/presets')
      .then((res) => res.json())
      .then((data) => {
        if (data.summaries) {
          setPresets(data.summaries);
        }
      })
      .catch((err) => {
        console.error('Failed to load presets:', err);
      });
  }, [open]);

  // Sync state when currentItinerary changes
  useEffect(() => {
    if (!currentItinerary) return;
    setOrigin(currentItinerary.origin);
    setDestination(currentItinerary.destination);
    setTravelDate(currentItinerary.travelDateIso ? currentItinerary.travelDateIso.slice(0, 10) : '2026-08-27');
    setTripPurpose(currentItinerary.tripPurpose);
    if (currentItinerary.passenger) {
      setPassengerName(currentItinerary.passenger.name);
      setTicketRef(currentItinerary.passenger.ticketReference);
      setLoyaltyProgram(currentItinerary.passenger.loyaltyProgram || '');
      setLoyaltyTier(currentItinerary.passenger.loyaltyTier || '');
      setContactEmail(currentItinerary.passenger.contactEmail || '');
    }
    if (currentItinerary.mission) {
      setMissionTitle(currentItinerary.mission.title);
      setMissionVenue(currentItinerary.mission.venue || '');
      if (currentItinerary.mission.dealValue) {
        setDealValue(String(currentItinerary.mission.dealValue));
      }
    }
    if (currentItinerary.constraints) {
      setBudgetUsd(currentItinerary.constraints.budgetUsd);
      setMctMin(currentItinerary.constraints.mctMin);
      setBaggagePieces(currentItinerary.constraints.baggagePieces);
      setBaggageWeightKg(currentItinerary.constraints.baggageWeightKg);
    }
    if (currentItinerary.legs) {
      setLegs(currentItinerary.legs);
    }
    setRawJsonText(JSON.stringify(currentItinerary, null, 2));
  }, [currentItinerary]);

  const handleActivatePreset = async (presetId: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/itinerary/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presetId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to activate preset');
      }
      toast({
        title: 'Preset Activated',
        description: `Switched itinerary to preset "${presetId}".`,
      });
      onItineraryUpdated();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Activation Failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddLeg = () => {
    const lastLeg = legs[legs.length - 1];
    const newFrom = lastLeg ? lastLeg.to : origin;
    const newTo = destination;
    const newLeg: FlightLeg = {
      flightNumber: 'FL' + Math.floor(100 + Math.random() * 899),
      airlineCode: 'SQ',
      airlineName: 'Singapore Airlines',
      from: newFrom,
      to: newTo,
      depIso: `${travelDate}T12:00:00+08:00`,
      arrIso: `${travelDate}T16:00:00+08:00`,
      durationMin: 240,
      aircraft: 'Boeing 787-9',
      cabin: 'Economy',
    };
    setLegs([...legs, newLeg]);
  };

  const handleRemoveLeg = (idx: number) => {
    if (legs.length <= 1) {
      toast({
        title: 'Cannot Remove Leg',
        description: 'An itinerary must contain at least one flight leg.',
        variant: 'destructive',
      });
      return;
    }
    setLegs(legs.filter((_, i) => i !== idx));
  };

  const handleUpdateLeg = (idx: number, field: keyof FlightLeg, value: any) => {
    const updated = [...legs];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === 'airlineCode') {
      updated[idx].airlineName = getAirlineName(value);
    }
    setLegs(updated);
  };

  const handleSaveCustomItinerary = async () => {
    setLoading(true);
    try {
      const tripId = `TRIP-${origin.toUpperCase()}-${destination.toUpperCase()}-${new Date().getFullYear()}`;
      const customItinerary: Itinerary = {
        tripId,
        origin: origin.toUpperCase(),
        destination: destination.toUpperCase(),
        travelDateIso: `${travelDate}T00:00:00+00:00`,
        tripPurpose,
        legs,
        passenger: {
          name: passengerName,
          ticketReference: ticketRef,
          loyaltyProgram,
          loyaltyTier,
          loyaltyNumber: 'LY-' + ticketRef,
          nationality: 'SG',
          contactEmail,
          contactPhone: '+1-555-0199',
          checkedBags: baggagePieces,
          loyalty: loyaltyTier,
        },
        mission: {
          title: missionTitle,
          description: tripPurpose,
          venue: missionVenue,
          location: getAirportCity(destination.toUpperCase()),
          dealValue: Number(dealValue) || undefined,
          dealCurrency: 'USD',
          importance: 'CRITICAL',
          deadlineIso: `${travelDate}T18:00:00+00:00`,
          timezone: 'UTC',
        },
        constraints: {
          budgetUsd: Number(budgetUsd),
          mctMin: Number(mctMin),
          arrivalDeadlineIso: `${travelDate}T23:59:00+00:00`,
          hardArrivalLimitIso: `${travelDate}T23:59:00+00:00`,
          baggagePieces: Number(baggagePieces),
          baggageWeightKg: Number(baggageWeightKg),
        },
        commitments: [
          {
            id: 'comm-meeting',
            kind: 'MEETING',
            label: missionTitle,
            atIso: `${travelDate}T18:00:00+00:00`,
            location: missionVenue || 'Executive Venue',
            detail: missionTitle,
          },
        ],
      };

      const res = await fetch('/api/itinerary/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itinerary: customItinerary }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save custom itinerary');
      }

      toast({
        title: 'Custom Itinerary Activated',
        description: `Set active route: ${origin.toUpperCase()} → ${destination.toUpperCase()}`,
      });
      onItineraryUpdated();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Save Failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImportPnr = async () => {
    if (!rawPnrText.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/itinerary/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'pnr', data: rawPnrText, setActive: true }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'PNR Import failed');
      }
      const data = await res.json();
      toast({
        title: 'PNR Imported & Activated',
        description: `Route: ${data.itinerary.origin} → ${data.itinerary.destination} (${data.itinerary.legs.length} legs)`,
      });
      onItineraryUpdated();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'PNR Parse Error',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImportJson = async () => {
    if (!rawJsonText.trim()) return;
    setLoading(true);
    try {
      const parsed = JSON.parse(rawJsonText);
      const res = await fetch('/api/itinerary/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'json', data: parsed, setActive: true }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'JSON Import failed');
      }
      toast({
        title: 'JSON Imported & Activated',
        description: 'Successfully loaded and set dynamic itinerary.',
      });
      onItineraryUpdated();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'JSON Parse Error',
        description: err instanceof Error ? err.message : 'Invalid JSON format',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto overflow-x-hidden rounded-2xl border border-zinc-800/90 bg-zinc-950/95 text-zinc-100 p-6 sm:p-8 shadow-2xl shadow-black/80 backdrop-blur-xl [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-800 [&::-webkit-scrollbar-track]:bg-transparent">
        <DialogHeader className="border-b border-zinc-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Globe2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                Itinerary Studio
                <Badge variant="outline" className="border-amber-500/40 text-amber-300 font-mono text-[10px]">
                  Enterprise Dynamic Engine
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Create, import, and customize multi-leg flight itineraries, passenger profiles, and corporate policy rules.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="mt-4">
          <TabsList className="grid grid-cols-3 bg-zinc-900/80 border border-zinc-800">
            <TabsTrigger value="presets" className="flex items-center gap-2 text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              Global Presets
            </TabsTrigger>
            <TabsTrigger value="custom" className="flex items-center gap-2 text-xs font-semibold">
              <Plus className="h-3.5 w-3.5 text-blue-400" />
              Custom Builder
            </TabsTrigger>
            <TabsTrigger value="import" className="flex items-center gap-2 text-xs font-semibold">
              <Upload className="h-3.5 w-3.5 text-emerald-400" />
              PNR / JSON Import
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: PRESETS CATALOG */}
          <TabsContent value="presets" className="mt-5 space-y-4">
            <div className="text-xs text-zinc-400 mb-2">
              Select an enterprise corridor to immediately populate the Operations Cockpit and test recovery simulations:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {presets.map((preset) => {
                const isActive = currentItinerary?.tripId === preset.tripId;
                return (
                  <div
                    key={preset.id}
                    className={`rounded-xl border p-4 transition-all ${
                      isActive
                        ? 'border-amber-500/60 bg-amber-500/[0.06] shadow-sm shadow-amber-500/10'
                        : 'border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/70'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-mono text-base font-bold text-zinc-100 flex items-center gap-1.5">
                          {preset.origin} <ArrowRight className="h-3.5 w-3.5 text-zinc-500" /> {preset.destination}
                        </div>
                        <div className="text-xs font-semibold text-zinc-300 mt-0.5">{preset.name}</div>
                      </div>
                      <Badge className={isActive ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px]' : 'bg-zinc-800 text-zinc-400 text-[10px]'}>
                        {isActive ? 'Active Trip' : `${preset.legsCount} leg${preset.legsCount > 1 ? 's' : ''}`}
                      </Badge>
                    </div>

                    <p className="mt-2 text-[11px] text-zinc-400 line-clamp-1">{preset.tagline}</p>

                    <div className="mt-3 flex flex-wrap gap-1">
                      {preset.tags.map((t) => (
                        <span key={t} className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-[9.5px] font-mono text-zinc-400">
                          {t}
                        </span>
                      ))}
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-zinc-800/60 pt-3">
                      <div className="text-[11px] text-zinc-400 font-mono">
                        {preset.primaryAirline} · ${preset.budgetUsd} budget
                      </div>
                      <Button
                        size="sm"
                        disabled={loading || isActive}
                        onClick={() => handleActivatePreset(preset.id)}
                        className={`h-7 px-3 text-xs font-bold ${
                          isActive
                            ? 'bg-zinc-800 text-zinc-500 cursor-default'
                            : 'bg-amber-500 hover:bg-amber-400 text-zinc-950'
                        }`}
                      >
                        {isActive ? (
                          <span className="flex items-center gap-1">
                            <Check className="h-3 w-3" /> Active
                          </span>
                        ) : (
                          'Load Preset'
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* TAB 2: CUSTOM ITINERARY BUILDER */}
          <TabsContent value="custom" className="mt-5 space-y-6">
            {/* Basic Route Info */}
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 space-y-4">
              <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-amber-400">
                <Globe2 className="h-4 w-4" /> Route & Schedule
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <Label className="text-xs text-zinc-400">Origin IATA</Label>
                  <Input
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value.toUpperCase())}
                    placeholder="e.g. LHR"
                    className="mt-1 font-mono uppercase bg-zinc-950 border-zinc-800"
                    maxLength={3}
                  />
                  <span className="text-[10px] text-zinc-500 font-mono">{getAirportCity(origin)} ({getAirportName(origin)})</span>
                </div>
                <div>
                  <Label className="text-xs text-zinc-400">Destination IATA</Label>
                  <Input
                    value={destination}
                    onChange={(e) => setDestination(e.target.value.toUpperCase())}
                    placeholder="e.g. JFK"
                    className="mt-1 font-mono uppercase bg-zinc-950 border-zinc-800"
                    maxLength={3}
                  />
                  <span className="text-[10px] text-zinc-500 font-mono">{getAirportCity(destination)} ({getAirportName(destination)})</span>
                </div>
                <div>
                  <Label className="text-xs text-zinc-400">Departure Date</Label>
                  <Input
                    type="date"
                    value={travelDate}
                    onChange={(e) => setTravelDate(e.target.value)}
                    className="mt-1 font-mono bg-zinc-950 border-zinc-800"
                  />
                </div>
              </div>
            </div>

            {/* Multi-Leg Flight Builder */}
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-blue-400">
                  <Plane className="h-4 w-4" /> Flight Legs ({legs.length})
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddLeg}
                  className="h-7 text-xs border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Leg
                </Button>
              </div>

              <div className="space-y-3">
                {legs.map((leg, idx) => (
                  <div key={idx} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-amber-300">
                        Leg #{idx + 1}: {leg.from} → {leg.to}
                      </span>
                      {legs.length > 1 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveLeg(idx)}
                          className="h-6 w-6 p-0 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <Label className="text-[10.5px] text-zinc-400">Flight Number</Label>
                        <Input
                          value={leg.flightNumber}
                          onChange={(e) => handleUpdateLeg(idx, 'flightNumber', e.target.value.toUpperCase())}
                          className="h-8 font-mono text-xs bg-zinc-900 border-zinc-800"
                        />
                      </div>
                      <div>
                        <Label className="text-[10.5px] text-zinc-400">Airline Code</Label>
                        <Input
                          value={leg.airlineCode}
                          onChange={(e) => handleUpdateLeg(idx, 'airlineCode', e.target.value.toUpperCase())}
                          className="h-8 font-mono text-xs bg-zinc-900 border-zinc-800"
                          maxLength={3}
                        />
                      </div>
                      <div>
                        <Label className="text-[10.5px] text-zinc-400">From</Label>
                        <Input
                          value={leg.from}
                          onChange={(e) => handleUpdateLeg(idx, 'from', e.target.value.toUpperCase())}
                          className="h-8 font-mono text-xs bg-zinc-900 border-zinc-800"
                          maxLength={3}
                        />
                      </div>
                      <div>
                        <Label className="text-[10.5px] text-zinc-400">To</Label>
                        <Input
                          value={leg.to}
                          onChange={(e) => handleUpdateLeg(idx, 'to', e.target.value.toUpperCase())}
                          className="h-8 font-mono text-xs bg-zinc-900 border-zinc-800"
                          maxLength={3}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Passenger Profile & Corporate Policy Constraints */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Passenger */}
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 space-y-3">
                <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-emerald-400">
                  <User className="h-4 w-4" /> Passenger Profile
                </div>
                <div>
                  <Label className="text-xs text-zinc-400">Full Name</Label>
                  <Input
                    value={passengerName}
                    onChange={(e) => setPassengerName(e.target.value)}
                    className="mt-1 bg-zinc-950 border-zinc-800 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs text-zinc-400">Ticket Reference / PNR</Label>
                  <Input
                    value={ticketRef}
                    onChange={(e) => setTicketRef(e.target.value.toUpperCase())}
                    className="mt-1 font-mono bg-zinc-950 border-zinc-800 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs text-zinc-400">Loyalty Program & Tier</Label>
                  <Input
                    value={loyaltyTier}
                    onChange={(e) => setLoyaltyTier(e.target.value)}
                    className="mt-1 bg-zinc-950 border-zinc-800 text-xs"
                  />
                </div>
              </div>

              {/* Hard Constraints */}
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 space-y-3">
                <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-amber-400">
                  <Shield className="h-4 w-4" /> Policy Constraints (Hard Rules)
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-zinc-400">Budget Ceiling ($)</Label>
                    <Input
                      type="number"
                      value={budgetUsd}
                      onChange={(e) => setBudgetUsd(Number(e.target.value))}
                      className="mt-1 font-mono bg-zinc-950 border-zinc-800 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-zinc-400">MCT Floor (min)</Label>
                    <Input
                      type="number"
                      value={mctMin}
                      onChange={(e) => setMctMin(Number(e.target.value))}
                      className="mt-1 font-mono bg-zinc-950 border-zinc-800 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-zinc-400">Baggage Pieces</Label>
                    <Input
                      type="number"
                      value={baggagePieces}
                      onChange={(e) => setBaggagePieces(Number(e.target.value))}
                      className="mt-1 font-mono bg-zinc-950 border-zinc-800 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-zinc-400">Max Weight (kg)</Label>
                    <Input
                      type="number"
                      value={baggageWeightKg}
                      onChange={(e) => setBaggageWeightKg(Number(e.target.value))}
                      className="mt-1 font-mono bg-zinc-950 border-zinc-800 text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            <Button
              disabled={loading}
              onClick={handleSaveCustomItinerary}
              className="w-full h-10 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold"
            >
              {loading ? 'Saving Itinerary...' : 'Save & Activate Custom Itinerary'}
            </Button>
          </TabsContent>

          {/* TAB 3: PNR & JSON IMPORT/EXPORT */}
          <TabsContent value="import" className="mt-5 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* PNR Text Import */}
              <div className="flex flex-col justify-between rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5 backdrop-blur-sm space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-amber-400">
                      <FileCode className="h-4 w-4" /> Raw GDS PNR Import
                    </div>
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] text-amber-300">
                      Amadeus · Sabre
                    </span>
                  </div>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-zinc-400">
                    Paste raw GDS terminal text to auto-parse passenger identities and multi-leg flights:
                  </p>
                  <Textarea
                    value={rawPnrText}
                    onChange={(e) => setRawPnrText(e.target.value)}
                    placeholder={'1.1CHEN/WEI MR\n1 SQ 856 Y 27AUG SINHKG HK1 0800 1205\n2 CX 520 Y 27AUG HKGNRT HK1 1430 1945'}
                    className="mt-3 font-mono text-[11.5px] leading-relaxed bg-zinc-950/80 border-zinc-800/90 text-zinc-200 h-48 rounded-xl p-3 resize-none focus-visible:ring-amber-400/40 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-800"
                  />
                </div>
                <Button
                  disabled={loading || !rawPnrText.trim()}
                  onClick={handleImportPnr}
                  className="w-full h-10 bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 text-zinc-950 text-xs font-extrabold shadow-md shadow-amber-500/20"
                >
                  {loading ? 'Parsing PNR...' : 'Parse & Activate PNR Itinerary'}
                </Button>
              </div>

              {/* JSON Import/Export */}
              <div className="flex flex-col justify-between rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5 backdrop-blur-sm space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-sky-400">
                      <Layers className="h-4 w-4" /> Full JSON Schema Payload
                    </div>
                    <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 font-mono text-[10px] text-sky-300">
                      Dynamic Itinerary
                    </span>
                  </div>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-zinc-400">
                    Export active trip configuration or import custom JSON schema payload:
                  </p>
                  <Textarea
                    value={rawJsonText}
                    onChange={(e) => setRawJsonText(e.target.value)}
                    className="mt-3 font-mono text-[11px] leading-relaxed bg-zinc-950/80 border-zinc-800/90 text-zinc-300 h-48 rounded-xl p-3 resize-none focus-visible:ring-sky-400/40 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-800"
                  />
                </div>
                <div className="flex items-center gap-2.5 pt-1">
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(rawJsonText);
                      toast({ title: 'JSON Copied', description: 'Itinerary JSON copied to clipboard.' });
                    }}
                    className="flex-1 h-10 text-xs font-bold border-zinc-700 bg-zinc-900/80 hover:bg-zinc-800 hover:text-zinc-100 text-zinc-300 rounded-xl"
                  >
                    <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy JSON
                  </Button>
                  <Button
                    disabled={loading || !rawJsonText.trim()}
                    onClick={handleImportJson}
                    className="flex-1 h-10 bg-gradient-to-r from-sky-500 to-blue-600 hover:brightness-110 text-white text-xs font-extrabold rounded-xl shadow-md shadow-sky-500/20"
                  >
                    {loading ? 'Importing...' : 'Import & Activate JSON'}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
