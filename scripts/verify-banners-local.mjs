import assert from "node:assert/strict";
import sharp from "sharp";
export async function verifyBannersUi({page,publicPage,expect,admin,anonymous,rpc,runId,catalogIds,bannerFiles}) {
 await publicPage.emulateMedia({reducedMotion:"reduce"});
 const errors=[],onError=e=>errors.push(e.message.slice(0,500));page.on("pageerror",onError);publicPage.on("pageerror",onError);
 const slots=(await admin.client.from("home_banners").select("slot,title,image_path,product_id,active,version").order("slot")).data;
 const empty=slots.filter(b=>!b.title&&!b.image_path&&!b.product_id&&!b.active);
 if(empty.length<2){console.log("Banner UI write check skipped: fewer than two unused positions; existing shop banners preserved.");await publicPage.close();return;}
 const [first,second]=empty;
 const created=await rpc(admin,"save_catalog_item",{p_item:{name:`Banner product ${runId}`,description:"Banner regression fixture",category:"keyboard",type:"product",unit:"bộ",price:700000,cost:0,active:true,imagePath:null,lubePackage:""}});assert.equal(created.data.ok,true);const product=created.data.id;catalogIds.push(product);
 const params=(slot,version,title,image,active=true)=>({p_slot:slot,p_version:version,p_title:title,p_subtitle:"Ảnh kiểm thử — không phải nội dung shop",p_image:image,p_product:Number(product),p_active:active,p_clear:false});
 assert.equal((await rpc(admin,"save_home_banner",params(first.slot,first.version,`Reserved ${runId}`,"",false))).data.ok,true);
 await page.goto("http://localhost:3000/admin/banners");
 // Slots are fixed, so indexing is stable even when another admin fills a different slot.
 const form=page.locator(".banner-editor").nth(first.slot-1);
 await expect(form).toHaveAttribute("open","");
 await form.getByLabel("Tiêu đề banner",{exact:true}).fill(`Banner fixture ${runId}`);
 await form.getByLabel("Mô tả ngắn",{exact:true}).fill("Khám phá bàn phím và các góc chụp — nội dung kiểm thử.");
 await form.getByLabel("Sản phẩm liên kết",{exact:true}).selectOption(String(product));
 await form.getByLabel("Công khai trên trang chủ",{exact:true}).check();
 await form.getByLabel("Ảnh banner",{exact:true}).setInputFiles({name:"fake.png",mimeType:"image/png",buffer:Buffer.from("invalid image fixture")});
 await expect(form.locator('.banner-crop [role="alert"]')).toContainText("Không đọc được ảnh");await form.getByRole("button",{name:"Lưu banner",exact:true}).click();await expect(form.getByRole("status")).toContainText("Cần tiêu đề, ảnh và sản phẩm trước khi công khai.");await expect(form.getByLabel("Tiêu đề banner",{exact:true})).toHaveValue(`Banner fixture ${runId}`);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="720"><rect width="1920" height="720" fill="#f5c65c"/><text x="130" y="220" font-size="55" font-family="Arial" fill="#463220">BANNER TEST FIXTURE</text><text x="130" y="300" font-size="32" font-family="Arial" fill="#463220">Keyboard showcase</text><rect x="920" y="180" width="850" height="350" rx="30" fill="#433c33"/>${Array.from({length:48},(_,n)=>`<rect x="${960+n%12*64}" y="${215+Math.floor(n/12)*72}" width="52" height="56" rx="6" fill="${n===0?"#eab53b":"#fff7e8"}"/>`).join("")}</svg>`;
 await form.getByLabel("Ảnh banner",{exact:true}).setInputFiles({name:"banner-fixture.png",mimeType:"image/png",buffer:await sharp(Buffer.from(svg)).png().toBuffer()});
 await expect(form.locator(".banner-crop-frame")).toBeVisible();
 await form.getByLabel("Phóng đại ảnh banner",{exact:true}).fill("1.4");
 await form.getByLabel("Vị trí ngang ảnh banner",{exact:true}).fill("75");
 const frame=form.locator(".banner-crop-frame");
 await frame.scrollIntoViewIfNeeded();
 const cropBox=await frame.boundingBox(),beforeDrag=JSON.parse(await form.locator('[name="crop"]').inputValue());
 await page.mouse.move(cropBox.x+cropBox.width*.6,cropBox.y+cropBox.height*.5);await page.mouse.down();await page.mouse.move(cropBox.x+cropBox.width*.4,cropBox.y+cropBox.height*.5,{steps:8});await page.mouse.up();
 const selectedCrop=JSON.parse(await form.locator('[name="crop"]').inputValue());assert.ok(selectedCrop.left>beforeDrag.left,"drag changes selected region");
 await form.getByLabel("Vị trí dọc ảnh banner",{exact:true}).focus();await page.keyboard.press("ArrowRight");
 for(const width of [1440,375]){
  await page.setViewportSize({width,height:900});await frame.scrollIntoViewIfNeeded();
  if(width===375){
   const box=await frame.boundingBox(),before=await form.locator('[name="crop"]').inputValue(),touch=await page.context().newCDPSession(page);
   await touch.send("Emulation.setTouchEmulationEnabled",{enabled:true});
   await touch.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:box.x+box.width*.4,y:box.y+box.height*.5}]});
   await touch.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:box.x+box.width*.6,y:box.y+box.height*.5}]});
   await touch.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
   await expect.poll(()=>form.locator('[name="crop"]').inputValue()).not.toBe(before);
   await touch.send("Emulation.setTouchEmulationEnabled",{enabled:false});await touch.detach();
  }
  await page.screenshot({path:`output/playwright/banner-crop-${width}.png`});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 }
 const cropValue=await form.locator('[name="crop"]').inputValue();
 await form.locator('[name="crop"]').evaluate(el=>{el.value=JSON.stringify({left:999999,top:0,width:300,height:200});});
 await form.getByRole("button",{name:"Lưu banner",exact:true}).click();await expect(form.getByRole("status")).toContainText("Vùng cắt vượt quá");
 await expect(frame).toBeVisible();await expect(form.getByLabel("Tiêu đề banner",{exact:true})).toHaveValue(`Banner fixture ${runId}`);
 await form.locator('[name="crop"]').evaluate((el,value)=>{el.value=value;},cropValue);
 await form.getByRole("button",{name:"Lưu banner",exact:true}).click();await expect(form.getByRole("status")).toContainText("Đã lưu banner");
 let stored=(await admin.client.from("home_banners").select("image_path,version").eq("slot",first.slot).single()).data;
 assert.ok(stored.image_path);
 bannerFiles.push(stored.image_path);
 const savedImage=await admin.client.storage.from("home-banners").download(stored.image_path);assert.equal(savedImage.error,null);
 const savedMeta=await sharp(Buffer.from(await savedImage.data.arrayBuffer())).metadata(),chosen=JSON.parse(cropValue);
 assert.equal(savedMeta.width,chosen.width);assert.equal(savedMeta.height,chosen.height);
 // Reopen the saved image without uploading a new file, then crop it again.
 await form.getByRole("button",{name:"Căn lại ảnh hiện tại",exact:true}).click();await expect(frame).toBeVisible();
 await form.getByLabel("Phóng đại ảnh banner",{exact:true}).fill("1.2");
 await form.getByLabel("Vị trí ngang ảnh banner",{exact:true}).focus();await page.keyboard.press("ArrowRight");
 await form.getByRole("button",{name:"Lưu banner",exact:true}).click();await expect(form.getByRole("status")).toContainText("Đã lưu banner");
 await expect(frame).toHaveCount(0);
 stored=(await admin.client.from("home_banners").select("image_path,version").eq("slot",first.slot).single()).data;bannerFiles.push(stored.image_path);
 const secondSaved=await rpc(admin,"save_home_banner",params(second.slot,second.version,`Banner second ${runId}`,stored.image_path));assert.equal(secondSaved.data.ok,true);
 const guest=await anonymous.from("home_banners").select("slot,title");assert.ok(guest.data.some(b=>b.slot===first.slot));
 await publicPage.goto("http://localhost:3000/",{waitUntil:"networkidle"});
 const banner=publicPage.getByRole("region",{name:"Sản phẩm nổi bật",exact:true});await expect(banner).toBeVisible();
 const visible=guest.data.slice().sort((a,b)=>a.slot-b.slot),index=visible.findIndex(b=>b.slot===first.slot);
 await banner.getByRole("button",{name:`Xem banner ${index+1}`,exact:true}).click();await expect(banner.getByRole("heading",{name:`Banner fixture ${runId}`,exact:true})).toBeVisible();
 await expect.poll(()=>banner.locator("img").evaluate(img=>img.naturalWidth)).toBeGreaterThan(0);
 for(const width of [1440,375]){
  await publicPage.setViewportSize({width,height:900});await expect.poll(()=>publicPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await publicPage.evaluate(()=>window.scrollTo({top:0,behavior:"instant"}));
  await publicPage.screenshot({path:`output/playwright/banner-home-${width}.png`,caret:"initial"});
  await page.setViewportSize({width,height:900});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await form.scrollIntoViewIfNeeded();await page.screenshot({path:`output/playwright/banner-admin-${width}.png`,fullPage:true,caret:"initial"});
 }
 const stage=banner.locator(".home-banner-stage");await stage.focus();await publicPage.keyboard.press("ArrowRight");await expect(banner.getByRole("status")).toHaveText(`${(index+1)%visible.length+1} / ${visible.length}`);
 await banner.getByRole("button",{name:`Xem banner ${index+1}`,exact:true}).click();
 await stage.scrollIntoViewIfNeeded();const box=await stage.boundingBox(),cdp=await publicPage.context().newCDPSession(publicPage);
 await cdp.send("Emulation.setTouchEmulationEnabled",{enabled:true});
 await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:box.x+box.width*.8,y:box.y+Math.min(55,box.height/2)}]});
 for(let n=1;n<=6;n++)await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:box.x+box.width*(.8-.6*n/6),y:box.y+Math.min(55,box.height/2)}]});
 await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});await expect(banner.getByRole("status")).toHaveText(`${(index+1)%visible.length+1} / ${visible.length}`);await cdp.detach();
 await banner.getByRole("button",{name:`Xem banner ${index+1}`,exact:true}).click();
 // Real elapsed-time checks: autoplay starts at four seconds and pauses for reading.
 await publicPage.emulateMedia({reducedMotion:"no-preference"});
 await publicPage.mouse.move(0,0);await publicPage.locator(".site-header .brand").focus();
 const before=Date.now();
 await expect(banner.getByRole("status")).toHaveText(`${(index+1)%visible.length+1} / ${visible.length}`);
 assert.ok(Date.now()-before>=3000,"banner must not advance immediately");
 await banner.locator(".home-banner-caption").hover();const paused=await banner.getByRole("status").textContent();
 await publicPage.waitForTimeout(4300);await expect(banner.getByRole("status")).toHaveText(paused);
 await banner.getByRole("button",{name:"Tạm dừng tự chuyển banner",exact:true}).click();await publicPage.mouse.move(0,0);await publicPage.locator(".site-header .brand").focus();
 await publicPage.waitForTimeout(4300);await expect(banner.getByRole("status")).toHaveText(paused);
 await banner.getByRole("button",{name:"Bật tự chuyển banner",exact:true}).click();await publicPage.mouse.move(0,0);await publicPage.locator(".site-header .brand").focus();
 await expect(banner.getByRole("status")).not.toHaveText(paused);
 await publicPage.emulateMedia({reducedMotion:"reduce"});await publicPage.reload();
 await expect(banner.getByRole("button",{name:"Bật tự chuyển banner",exact:true})).toBeVisible();
 const still=await banner.getByRole("status").textContent();await publicPage.waitForTimeout(4300);await expect(banner.getByRole("status")).toHaveText(still);
 await banner.getByRole("button",{name:`Xem banner ${index+1}`,exact:true}).click();await banner.getByRole("link",{name:"Xem sản phẩm",exact:true}).click();await expect(publicPage).toHaveURL(new RegExp(`/shop/${product}$`));
 // Hiding the product must remove its banners from the anonymous page immediately.
 assert.equal((await rpc(admin,"save_catalog_item",{p_item:{id:product,version:1,name:`Banner product ${runId}`,description:"Banner regression fixture",category:"keyboard",type:"product",unit:"bộ",price:700000,cost:0,active:false,imagePath:null,lubePackage:""}})).data.ok,true);
 await publicPage.goto("http://localhost:3000/");await expect(publicPage.getByRole("heading",{name:`Banner fixture ${runId}`,exact:true})).toHaveCount(0);assert.equal((await anonymous.from("home_banners").select("slot").in("slot",[first.slot,second.slot])).data.length,0);
 // Hide and clear through real Server Actions, including a now-hidden product.
 await page.goto("http://localhost:3000/admin/banners");
 await form.getByLabel("Công khai trên trang chủ",{exact:true}).uncheck();await form.getByRole("button",{name:"Lưu banner",exact:true}).click();await expect(form.getByRole("status")).toContainText("Đã lưu banner");
 await form.getByText("Gỡ nội dung banner này",{exact:true}).click();
 await form.getByRole("button",{name:"Xác nhận gỡ banner",exact:true}).click();await expect(form.getByRole("status")).toContainText("Đánh dấu xác nhận");
 await form.getByLabel("Tôi muốn gỡ toàn bộ nội dung banner này",{exact:true}).check();await form.getByRole("button",{name:"Xác nhận gỡ banner",exact:true}).click();await expect(form.getByRole("status")).toContainText("Đã gỡ banner");
 const row=(await admin.client.from("home_banners").select("version").eq("slot",second.slot).single()).data;assert.equal((await rpc(admin,"save_home_banner",{...params(second.slot,row.version,"","",false),p_clear:true})).data.ok,true);
 assert.deepEqual(errors,[],"Banner pages hydrate without page errors");page.off("pageerror",onError);
 await page.setViewportSize({width:1440,height:1000});await publicPage.close();
}
