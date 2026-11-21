# Battery policy

A robot returns to charge when its battery drops below 25%, unless it carries a pallet.

## Exceptions

A loaded robot finishes the delivery first, down to 12%. Below 12% it stops where it is and calls for help.

## Charging slots

Six chargers serve twelve robots. When all six are busy, a robot below 25% waits in the lane next to the charger and blocks it.
