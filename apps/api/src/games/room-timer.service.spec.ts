import { RoomTimerService } from './room-timer.service';

describe('RoomTimerService', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('runs a scheduled room timer once', () => {
    const service = new RoomTimerService();
    const callback = jest.fn();

    service.schedule('ABCDEF', 'the-mind', Date.now() + 1_000, callback);
    jest.advanceTimersByTime(1_000);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('replaces an existing timer with the same key', () => {
    const service = new RoomTimerService();
    const oldCallback = jest.fn();
    const newCallback = jest.fn();

    service.schedule('ABCDEF', 'the-mind', Date.now() + 1_000, oldCallback);
    service.schedule('ABCDEF', 'the-mind', Date.now() + 2_000, newCallback);
    jest.advanceTimersByTime(2_000);

    expect(oldCallback).not.toHaveBeenCalled();
    expect(newCallback).toHaveBeenCalledTimes(1);
  });
});
