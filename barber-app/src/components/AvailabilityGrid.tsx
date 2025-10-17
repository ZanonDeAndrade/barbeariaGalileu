import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { SlotAvailability } from '../types';

interface AvailabilityGridProps {
  slots: SlotAvailability[];
  selectedSlot?: string;
  onSelect?: (slot: string) => void;
}

export function AvailabilityGrid({ slots, selectedSlot, onSelect }: AvailabilityGridProps) {
  const handleSelect = (slot: SlotAvailability) => {
    if (slot.status !== 'available') {
      return;
    }
    onSelect?.(slot.startTime);
  };

  const orderedSlots = [...slots].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  );

  return (
    <div className="availability-grid">
      {orderedSlots.length === 0 && (
        <div className="status-banner">Nenhum horário configurado para esta data.</div>
      )}
      {orderedSlots.map((slot) => {
        const label = format(new Date(slot.startTime), 'HH:mm', { locale: ptBR });
        const detailLabel =
          slot.status === 'available'
            ? 'Disponível'
            : slot.status === 'booked'
              ? 'Reservado'
              : 'Bloqueado';
        const isSelected = selectedSlot === slot.startTime;
        return (
          <button
            key={slot.startTime}
            type="button"
            className={`slot-button ${slot.status}${isSelected ? ' selected' : ''}`}
            onClick={() => handleSelect(slot)}
            disabled={slot.status !== 'available'}
          >
            <span>{label}</span>
            <small>{detailLabel}</small>
          </button>
        );
      })}
    </div>
  );
}
