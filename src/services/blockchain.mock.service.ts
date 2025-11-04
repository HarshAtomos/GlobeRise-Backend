class MockBlockchainService {
    async getStakedBalance(userId: string): Promise<number> {
        // simple deterministic mock: hash userId to number for dev only
        let hash = 0;
        for (let i = 0; i < userId.length; i++) hash += userId.charCodeAt(i);
        return (hash % 1000) + 100; // 100–1099 tokens
    }
}

export default new MockBlockchainService();
