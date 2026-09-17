export const manifest = {
  screens: {
    scr_s24of5: { name: "Landing", route: "/", position: { "x": 160, "y": 220 } },
    scr_v0ai55: { name: "Login", route: "/login", position: { "x": 1560, "y": 220 } },
    scr_l8rhq8: { name: "Signup · Choose plan", route: "/signup", state: { "step": "plan" }, position: { "x": 160, "y": 2200 } },
    scr_3vtv3c: { name: "Signup · Form", route: "/signup", state: { "step": "form" }, position: { "x": 1560, "y": 2200 } },
    scr_51oly8: { name: "Signup · Success", route: "/signup", state: { "step": "success" }, position: { "x": 2960, "y": 2200 } },
    scr_wsuad2: { name: "Gate · Activate access", route: "/gate", position: { "x": 1560, "y": 4180 } },
    scr_n4bmye: { name: "Admin · Payments", route: "/app/admin/payments", position: { "x": 160, "y": 8140 } },
    scr_isjjpa: { name: "Live Engine", route: "/engine", position: { "x": 160, "y": 10120 } }
  },
  sections: {
    sec_m5kq75: { name: "Landing & Authentication", x: 0, y: 0, width: 2920, height: 1180 },
    sec_6h8cex: { name: "Signup Pipeline", x: 0, y: 1980, width: 4320, height: 1180 },
    sec_m4463d: { name: "Gate Key Entry", x: 0, y: 3960, width: 2920, height: 1180 },
    sec_jrxkbf: { name: "Device Change Request", x: 0, y: 5940, width: 1520, height: 1180 },
    sec_rekkmk: { name: "Admin Dashboard", x: 0, y: 7920, width: 4320, height: 1180 },
    sec_u4r7cz: { name: "Live Engine", x: 0, y: 9900, width: 1520, height: 1180 },
    sec_weu4y1: { name: "Application Tools", x: 0, y: 11880, width: 1520, height: 1180 }
  },
  layers: [
  { kind: "section", id: "sec_m5kq75", children: [
    { kind: "screen", id: "scr_s24of5" },
    { kind: "screen", id: "scr_v0ai55" }]
  },
  { kind: "section", id: "sec_6h8cex", children: [
    { kind: "screen", id: "scr_l8rhq8" },
    { kind: "screen", id: "scr_3vtv3c" },
    { kind: "screen", id: "scr_51oly8" }]
  },
  { kind: "section", id: "sec_m4463d", children: [
    { kind: "screen", id: "scr_91q7za" },
    { kind: "screen", id: "scr_wsuad2" }]
  },
  { kind: "section", id: "sec_jrxkbf", children: [
    { kind: "screen", id: "scr_u64sk7" }]
  },
  { kind: "section", id: "sec_rekkmk", children: [
    { kind: "screen", id: "scr_n4bmye" },
    { kind: "screen", id: "scr_rjrviy" },
    { kind: "screen", id: "scr_ygmui2" }]
  },
  { kind: "section", id: "sec_u4r7cz", children: [
    { kind: "screen", id: "scr_isjjpa" }]
  },
  { kind: "section", id: "sec_weu4y1", children: [
    { kind: "screen", id: "scr_limz7x" }]
  }]

};