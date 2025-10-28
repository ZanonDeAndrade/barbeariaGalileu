const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api';
export class ApiError extends Error {
    constructor(status, message, details) {
        super(message);
        Object.defineProperty(this, "status", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "details", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.status = status;
        this.details = details;
    }
}
async function request(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
        ...options,
    });
    if (!response.ok) {
        let message = 'Erro inesperado na requisição';
        let details;
        try {
            const errorPayload = await response.json();
            message = errorPayload?.message ?? message;
            details = errorPayload?.details;
        }
        catch (error) {
            // ignore json parse errors
        }
        throw new ApiError(response.status, message, details);
    }
    if (response.status === 204) {
        return undefined;
    }
    return (await response.json());
}
export const api = {
    getHaircuts: () => request('/haircuts'),
    getAvailability: (date) => request(`/appointments/availability?date=${date}`),
    listAppointments: () => request('/appointments'),
    createBlockedSlot: (payload) => request('/blocked-slots', {
        method: 'POST',
        body: JSON.stringify(payload),
    }),
    listBlockedSlots: (date) => {
        const query = date ? `?date=${date}` : '';
        return request(`/blocked-slots${query}`);
    },
    removeBlockedSlot: (id) => request(`/blocked-slots/${id}`, {
        method: 'DELETE',
    }),
};
