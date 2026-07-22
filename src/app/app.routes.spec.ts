import { routes } from './app.routes';
import { mvpResultGuard } from './core/mvp/mvp-result.guard';
import { resultGuard } from './features/result.guard';

describe('app routes (MVP permanent flow)', () => {
  it('uses mvpResultGuard for the production /result route', () => {
    const resultRoute = routes.find((route) => route.path === 'result');

    expect(resultRoute).toBeTruthy();
    expect(resultRoute?.canActivate).toEqual([mvpResultGuard]);
  });

  it('does not use inherited resultGuard on the production /result route', () => {
    const resultRoute = routes.find((route) => route.path === 'result');
    const guards = resultRoute?.canActivate ?? [];

    expect(guards.includes(resultGuard)).toBeFalse();
  });
});
