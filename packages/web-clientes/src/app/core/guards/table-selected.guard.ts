import { inject } from '@angular/core'
import { CanActivateFn, Router } from '@angular/router'
import { CartStore } from '../store/cart.store'

/** La carta solo se abre si el cliente ya tiene una mesa ocupada en ese restaurante. */
export const tableSelectedGuard: CanActivateFn = (route) => {
  const cartStore = inject(CartStore)
  const router = inject(Router)
  const restaurantId = route.paramMap.get('id')!

  if (cartStore.table()?.restaurantId === restaurantId) {
    return true
  }
  return router.createUrlTree(['/restaurants', restaurantId, 'mesa'])
}
