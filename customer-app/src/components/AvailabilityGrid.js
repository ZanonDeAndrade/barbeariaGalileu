import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
export function AvailabilityGrid({ slots, selectedSlot, onSelect }) {
    const handleSelect = (slot) => {
        if (slot.status !== 'available') {
            return;
        }
        onSelect?.(slot.startTime);
    };
    const orderedSlots = [...slots].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    return (_jsxs("div", { className: "availability-grid", children: [orderedSlots.length === 0 && (_jsx("div", { className: "status-banner", children: "Nenhum hor\u00E1rio configurado para esta data." })), orderedSlots.map((slot) => {
                const label = format(new Date(slot.startTime), 'HH:mm', { locale: ptBR });
                const detailLabel = slot.status === 'available'
                    ? 'Disponível'
                    : slot.status === 'booked'
                        ? 'Reservado'
                        : 'Bloqueado';
                const isSelected = selectedSlot === slot.startTime;
                return (_jsxs("button", { type: "button", className: `slot-button ${slot.status}${isSelected ? ' selected' : ''}`, onClick: () => handleSelect(slot), disabled: slot.status !== 'available', children: [_jsx("span", { children: label }), _jsx("small", { children: detailLabel })] }, slot.startTime));
            })] }));
}
