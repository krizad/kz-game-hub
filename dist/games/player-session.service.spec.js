"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const player_session_service_1 = require("./player-session.service");
describe('PlayerSessionService', () => {
    let service;
    beforeEach(() => {
        service = new player_session_service_1.PlayerSessionService();
    });
    it('issues a private token that can only be consumed once', () => {
        service.issue('ABCDEF', 'player-1', 'socket-1');
        const token = service.takePendingToken('socket-1');
        expect(token).toBeTruthy();
        expect(service.consume('ABCDEF', token)).toBe('player-1');
        expect(service.consume('ABCDEF', token)).toBeNull();
    });
    it('rotates the token when issuing a replacement session', () => {
        service.issue('ABCDEF', 'player-1', 'socket-1');
        const firstToken = service.takePendingToken('socket-1');
        service.issue('ABCDEF', 'player-1', 'socket-2');
        const secondToken = service.takePendingToken('socket-2');
        expect(secondToken).not.toBe(firstToken);
        expect(service.consume('ABCDEF', firstToken)).toBeNull();
        expect(service.consume('ABCDEF', secondToken)).toBe('player-1');
    });
    it('verify does not consume the token', () => {
        service.issue('ABCDEF', 'player-1', 'socket-1');
        const token = service.takePendingToken('socket-1');
        expect(service.verify('ABCDEF', token)).toBe('player-1');
        expect(service.verify('ABCDEF', token)).toBe('player-1');
        expect(service.consume('ABCDEF', token)).toBe('player-1');
        expect(service.verify('ABCDEF', token)).toBeNull();
    });
    it('consume ignores unknown tokens without revoking others', () => {
        service.issue('ABCDEF', 'player-1', 'socket-1');
        const firstToken = service.takePendingToken('socket-1');
        service.issue('ABCDEF', 'player-2', 'socket-2');
        const secondToken = service.takePendingToken('socket-2');
        expect(service.consume('ABCDEF', 'not-a-token')).toBeNull();
        expect(service.consume('ABCDEF', firstToken)).toBe('player-1');
        expect(service.consume('ABCDEF', secondToken)).toBe('player-2');
    });
});
//# sourceMappingURL=player-session.service.spec.js.map