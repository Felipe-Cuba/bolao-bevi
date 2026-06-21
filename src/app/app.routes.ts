import { Routes } from '@angular/router';
import { WcPage } from './tabs/wc-page.component';

export const routes: Routes = [
  { path: '', component: WcPage },
  // Grupo de palpites compartilhados: o :codigo é o id/código de acesso do grupo.
  { path: 'g/:codigo', component: WcPage },
];
