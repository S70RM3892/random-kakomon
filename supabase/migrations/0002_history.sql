-- F10 履歴・分析のための追加。0001 を流したあとに実行する。
--
-- members は部屋ごとに別レコードなので、そのままでは部屋をまたいだ履歴が繋がらない。
-- 端末に保存する匿名 id を members に持たせて、同じ端末の演習結果を横串で集計できるようにする。
-- ログインは導入しない（SPEC F1）ので、端末を変えると履歴は引き継がれない。

alter table members
  add column if not exists device_id uuid;

create index if not exists members_device_idx on members (device_id);
