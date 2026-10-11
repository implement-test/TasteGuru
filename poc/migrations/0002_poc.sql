-- 앱 권한과 초대 링크, PoC 확인용 테이블
create table "profiles" ("user_id" text not null primary key references "user" ("id") on delete cascade, "role" text not null check ("role" in ('admin', 'member')), "created_at" integer not null);

create table "invites" ("token" text not null primary key, "created_by" text not null references "user" ("id"), "created_at" integer not null, "expires_at" integer not null, "used_by" text references "user" ("id"), "used_at" integer);

create table "poc_ping" ("id" integer primary key autoincrement, "created_at" integer not null);
