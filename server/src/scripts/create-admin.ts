import { register } from '../modules/auth/auth.service.js';

(async () => {
  try {
    const r = await register({
      name: 'Wendell Pereira',
      email: 'wendellpereira087@gmail.com',
      password: 'We22052205',
      organizationName: 'NEXA AI',
    });
    console.log('CRIADO:', JSON.stringify(r.user, null, 2));
  } catch (e) {
    console.error('ERRO:', (e as Error).message);
  }
})();
