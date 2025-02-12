import { describe, it, expect, vi, afterEach } from 'vitest';
import fetchMock from 'fetch-mock';
import { createConversationChatwood } from './chatwood'; // Replace with actual function names

describe('API request functions', () => {
    afterEach(() => {
        fetchMock.restore();
    });

    it('should return data on successful request', async () => {
        const mockData = { id: 123 };
        fetchMock.post('path:/api/v1/accounts/2/conversations', {
            status: 200,
            body: mockData,
        });

        const result = await createConversationChatwood(1); // Replace with actual function call
        expect(result).toEqual(mockData.id);
    });

    it('should handle error on failed request', async () => {
        fetchMock.post('path:/api/v1/accounts/2/conversations', 500);

        await expect(createConversationChatwood(1)).resolves.toEqual(0); // Replace with actual function call
    });
});