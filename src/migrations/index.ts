import * as migration_20260515_173454 from './20260515_173454';
import * as migration_20260516_055924 from './20260516_055924';
import * as migration_20260517_044621 from './20260517_044621';
import * as migration_20260517_050450 from './20260517_050450';
import * as migration_20260517_234713 from './20260517_234713';
import * as migration_20260603_225848_soft_delete from './20260603_225848_soft_delete';
import * as migration_20260604_012045_add_uploadthing_storage_fields from './20260604_012045_add_uploadthing_storage_fields';
import * as migration_20260606_soft_delete_media from './20260606_soft_delete_media';
import * as migration_20260607_164229_add_product_category_specs from './20260607_164229_add_product_category_specs';
import * as migration_20260630_whatsapp_orders from './20260630_whatsapp_orders';
import * as migration_20260630_182000_payment_proofs from './20260630_182000_payment_proofs';
import * as migration_20260630_190000_order_stock_decremented from './20260630_190000_order_stock_decremented';
import * as migration_20260630_191000_order_status_history from './20260630_191000_order_status_history';
import * as migration_20260630_192000_settings_payment from './20260630_192000_settings_payment';
import * as migration_20260630_193000_payment_proofs_review from './20260630_193000_payment_proofs_review';
import * as migration_20260630_194000_order_whatsapp_sent_at from './20260630_194000_order_whatsapp_sent_at';
import * as migration_20260630_195000_order_idempotency_key from './20260630_195000_order_idempotency_key';

export const migrations = [
  {
    up: migration_20260515_173454.up,
    down: migration_20260515_173454.down,
    name: '20260515_173454',
  },
  {
    up: migration_20260516_055924.up,
    down: migration_20260516_055924.down,
    name: '20260516_055924',
  },
  {
    up: migration_20260517_044621.up,
    down: migration_20260517_044621.down,
    name: '20260517_044621',
  },
  {
    up: migration_20260517_050450.up,
    down: migration_20260517_050450.down,
    name: '20260517_050450',
  },
  {
    up: migration_20260517_234713.up,
    down: migration_20260517_234713.down,
    name: '20260517_234713',
  },
  {
    up: migration_20260603_225848_soft_delete.up,
    down: migration_20260603_225848_soft_delete.down,
    name: '20260603_225848_soft_delete',
  },
  {
    up: migration_20260604_012045_add_uploadthing_storage_fields.up,
    down: migration_20260604_012045_add_uploadthing_storage_fields.down,
    name: '20260604_012045_add_uploadthing_storage_fields',
  },
  {
    up: migration_20260607_164229_add_product_category_specs.up,
    down: migration_20260607_164229_add_product_category_specs.down,
    name: '20260607_164229_add_product_category_specs'
  },
  {
    up: migration_20260606_soft_delete_media.up,
    down: migration_20260606_soft_delete_media.down,
    name: '20260606_soft_delete_media',
  },
  {
    up: migration_20260630_whatsapp_orders.up,
    down: migration_20260630_whatsapp_orders.down,
    name: '20260630_whatsapp_orders',
  },
  {
    up: migration_20260630_182000_payment_proofs.up,
    down: migration_20260630_182000_payment_proofs.down,
    name: '20260630_182000_payment_proofs',
  },
  {
    up: migration_20260630_190000_order_stock_decremented.up,
    down: migration_20260630_190000_order_stock_decremented.down,
    name: '20260630_190000_order_stock_decremented',
  },
  {
    up: migration_20260630_191000_order_status_history.up,
    down: migration_20260630_191000_order_status_history.down,
    name: '20260630_191000_order_status_history',
  },
  {
    up: migration_20260630_192000_settings_payment.up,
    down: migration_20260630_192000_settings_payment.down,
    name: '20260630_192000_settings_payment',
  },
  {
    up: migration_20260630_193000_payment_proofs_review.up,
    down: migration_20260630_193000_payment_proofs_review.down,
    name: '20260630_193000_payment_proofs_review',
  },
  {
    up: migration_20260630_194000_order_whatsapp_sent_at.up,
    down: migration_20260630_194000_order_whatsapp_sent_at.down,
    name: '20260630_194000_order_whatsapp_sent_at',
  },
  {
    up: migration_20260630_195000_order_idempotency_key.up,
    down: migration_20260630_195000_order_idempotency_key.down,
    name: '20260630_195000_order_idempotency_key',
  },
];
