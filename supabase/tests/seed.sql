insert into public.profiles (id, full_name, phone) values
  ('11111111-1111-1111-1111-111111111111','Owner A','01700000001'),
  ('22222222-2222-2222-2222-222222222222','Owner B','01700000002'),
  ('33333333-3333-3333-3333-333333333333','Rumi','01900000003'),
  ('44444444-4444-4444-4444-444444444444','Nadia','01900000004');

-- Open 10:00–20:00 every day, so a slot exists whichever day the test runs.
insert into public.shops (id, owner_id, name, business_type, weekly_hours) values
  ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Parlour A','PARLOUR',
   '{"mon":{"open":"10:00","close":"20:00","closed":false},"tue":{"open":"10:00","close":"20:00","closed":false},
     "wed":{"open":"10:00","close":"20:00","closed":false},"thu":{"open":"10:00","close":"20:00","closed":false},
     "fri":{"open":"10:00","close":"20:00","closed":false},"sat":{"open":"10:00","close":"20:00","closed":false},
     "sun":{"open":"10:00","close":"20:00","closed":false}}'::jsonb),
  ('bbbbbbbb-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','Parlour B','PARLOUR',
   '{"mon":{"open":"10:00","close":"20:00","closed":false},"tue":{"open":"10:00","close":"20:00","closed":false},
     "wed":{"open":"10:00","close":"20:00","closed":false},"thu":{"open":"10:00","close":"20:00","closed":false},
     "fri":{"open":"10:00","close":"20:00","closed":false},"sat":{"open":"10:00","close":"20:00","closed":false},
     "sun":{"open":"10:00","close":"20:00","closed":false}}'::jsonb);

insert into public.chairs (id, shop_id, label, staff_name) values
  ('cccccccc-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','Seat 1','Shila'),
  ('cccccccc-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','Seat 2','Mita'),
  ('dddddddd-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002','Seat 1','Rina');

insert into public.services (id, shop_id, name, rate, default_duration_min, category) values
  ('eeeeeeee-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','Facial',800,60,'FACIAL'),
  ('eeeeeeee-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','Mehendi',1500,120,'MEHENDI'),
  ('ffffffff-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002','Facial B',900,60,'FACIAL');
