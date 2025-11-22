import { api } from './api';
async function post(url, body) {
    const response = await api.post(url, body);
    return response.data;
}
export const paymentsApi = {
    processCard: (params) => post('/process-payment', params),
    createPix: (params) => post('/payment/pix', params),
    cash: (appointment) => post('/payment/cash', appointment),
};
