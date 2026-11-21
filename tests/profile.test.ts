import test from "node:test";
import assert from "node:assert/strict";
import { validateProfile } from "../src/lib/profile.ts";
test("profile validates only editable fields and normalizes Vietnamese contact data",()=>{
 const form=new FormData();form.set("name","  Nguyễn Minh  ");form.set("phone","0385 920-038");form.set("address","  123 Đường kiểm thử  ");form.set("role","admin");form.set("email","not-accepted@example.test");
 const result=validateProfile(form);assert.deepEqual(result,{profile:{name:"Nguyễn Minh",phone:"0385920038",address:"123 Đường kiểm thử"},errors:{}});
 form.set("phone","");form.set("address","");assert.deepEqual(validateProfile(form).errors,{});
 form.set("phone","abc");form.set("address","a".repeat(1001));form.set("name","");assert.deepEqual(Object.keys(validateProfile(form).errors).sort(),["address","name","phone"]);
});
