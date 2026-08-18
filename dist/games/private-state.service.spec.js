"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const private_state_service_1 = require("./private-state.service");
describe('PrivateStateService', () => {
    let service;
    beforeEach(() => {
        service = new private_state_service_1.PrivateStateService();
    });
    it('stores and retrieves per-socket values', () => {
        service.set('ROOM01', 'sockA', 'hand', [1, 2, 3]);
        expect(service.get('ROOM01', 'sockA', 'hand')).toEqual([1, 2, 3]);
        expect(service.get('ROOM01', 'sockB', 'hand')).toBeUndefined();
    });
    it('isolates data between rooms', () => {
        service.set('ROOM01', 'sockA', 'word', 'apple');
        service.set('ROOM02', 'sockA', 'word', 'banana');
        expect(service.get('ROOM01', 'sockA', 'word')).toBe('apple');
        expect(service.get('ROOM02', 'sockA', 'word')).toBe('banana');
    });
    it('returns full socket data and room-wide data by key', () => {
        service.setMany('ROOM01', 'sockA', { word: 'apple', role: 'KNOW' });
        service.set('ROOM01', 'sockB', 'role', 'HOST');
        expect(service.getSocketData('ROOM01', 'sockA')).toEqual({ word: 'apple', role: 'KNOW' });
        const roles = service.getRoomData('ROOM01', 'role');
        expect(roles.get('sockA')).toBe('KNOW');
        expect(roles.get('sockB')).toBe('HOST');
    });
    it('takeRoomData removes the key from all sockets after reading', () => {
        service.set('ROOM01', 'sockA', 'choice', 'ROCK');
        service.set('ROOM01', 'sockB', 'choice', 'PAPER');
        const taken = service.takeRoomData('ROOM01', 'choice');
        expect(taken.get('sockA')).toBe('ROCK');
        expect(service.get('ROOM01', 'sockA', 'choice')).toBeUndefined();
        expect(service.getSocketData('ROOM01', 'sockA')).toEqual({});
    });
    it('remaps data to a new socket id on reconnect', () => {
        service.set('ROOM01', 'oldSock', 'hand', [5]);
        service.set('ROOM01', 'oldSock', 'role', 'KNOW');
        service.remapSocketId('ROOM01', 'oldSock', 'newSock');
        expect(service.get('ROOM01', 'oldSock', 'hand')).toBeUndefined();
        expect(service.get('ROOM01', 'newSock', 'hand')).toEqual([5]);
        expect(service.get('ROOM01', 'newSock', 'role')).toBe('KNOW');
    });
    it('clearSocket removes only that socket data', () => {
        service.set('ROOM01', 'sockA', 'hand', [1]);
        service.set('ROOM01', 'sockB', 'hand', [2]);
        service.clearSocket('ROOM01', 'sockA');
        expect(service.getSocketData('ROOM01', 'sockA')).toEqual({});
        expect(service.get('ROOM01', 'sockB', 'hand')).toEqual([2]);
    });
    it('clearRoom removes everything for the room', () => {
        service.set('ROOM01', 'sockA', 'hand', [1]);
        service.clearRoom('ROOM01');
        expect(service.getSocketData('ROOM01', 'sockA')).toEqual({});
        expect(service.getRoomData('ROOM01', 'hand').size).toBe(0);
    });
    it('has() and delete() work per key', () => {
        service.set('ROOM01', 'sockA', 'a', 1);
        service.set('ROOM01', 'sockA', 'b', 2);
        expect(service.has('ROOM01', 'sockA', 'a')).toBe(true);
        expect(service.has('ROOM01', 'sockA', 'c')).toBe(false);
        service.delete('ROOM01', 'sockA', 'a');
        expect(service.has('ROOM01', 'sockA', 'a')).toBe(false);
        expect(service.get('ROOM01', 'sockA', 'b')).toBe(2);
    });
    it('delete of last key removes the socket entry entirely', () => {
        service.set('ROOM01', 'sockA', 'only', 1);
        service.delete('ROOM01', 'sockA', 'only');
        expect(service.getSocketData('ROOM01', 'sockA')).toEqual({});
    });
});
//# sourceMappingURL=private-state.service.spec.js.map