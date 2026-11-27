export interface SoundPreset {
  label: string;
  group: string;
  /** Archive path inside resource pack */
  path: string;
  /** Minecraft sound event ID for sounds.json */
  eventId: string;
  /** Recommended mono for 3D positional audio */
  recommendMono: boolean;
}

export const VANILLA_SOUND_PRESETS: SoundPreset[] = [
  // ======================== GIAO DIỆN (UI) ========================
  { label: 'Click nút UI (Button Click)', group: 'UI', path: 'assets/minecraft/sounds/random/click.ogg', eventId: 'ui.button.click', recommendMono: true },
  { label: 'Thông báo thành tựu (Toast Challenge)', group: 'UI', path: 'assets/minecraft/sounds/ui/toast/challenge_complete.ogg', eventId: 'ui.toast.challenge_complete', recommendMono: false },
  { label: 'Mở bảng / Toast In', group: 'UI', path: 'assets/minecraft/sounds/ui/toast/in.ogg', eventId: 'ui.toast.in', recommendMono: false },
  { label: 'Đóng bảng / Toast Out', group: 'UI', path: 'assets/minecraft/sounds/ui/toast/out.ogg', eventId: 'ui.toast.out', recommendMono: false },
  { label: 'Vẽ bản đồ (Cartography Table)', group: 'UI', path: 'assets/minecraft/sounds/ui/cartography_table/drawmap1.ogg', eventId: 'ui.cartography_table.take_result', recommendMono: true },
  { label: 'Cắt đá (Stonecutter)', group: 'UI', path: 'assets/minecraft/sounds/ui/stonecutter/cut1.ogg', eventId: 'ui.stonecutter.take_result', recommendMono: true },
  { label: 'Dệt vải (Loom)', group: 'UI', path: 'assets/minecraft/sounds/ui/loom/select_pattern1.ogg', eventId: 'ui.loom.select_pattern', recommendMono: true },

  // ======================== CHIẾN ĐẤU & VŨ KHÍ ========================
  { label: 'Đánh trúng / Sát thương (Hit 1)', group: 'Chiến đấu', path: 'assets/minecraft/sounds/damage/hit1.ogg', eventId: 'entity.player.hurt', recommendMono: true },
  { label: 'Sát thương lửa (Hurt Fire)', group: 'Chiến đấu', path: 'assets/minecraft/sounds/damage/firehurt1.ogg', eventId: 'entity.player.hurt_on_fire', recommendMono: true },
  { label: 'Đòn chí mạng (Crit 1)', group: 'Chiến đấu', path: 'assets/minecraft/sounds/entity/player/attack/crit1.ogg', eventId: 'entity.player.attack.crit', recommendMono: true },
  { label: 'Chém mạnh (Strong Attack)', group: 'Chiến đấu', path: 'assets/minecraft/sounds/entity/player/attack/strong1.ogg', eventId: 'entity.player.attack.strong', recommendMono: true },
  { label: 'Chém quét (Sweep Attack)', group: 'Chiến đấu', path: 'assets/minecraft/sounds/entity/player/attack/sweep1.ogg', eventId: 'entity.player.attack.sweep', recommendMono: true },
  { label: 'Đánh hất văng (Knockback)', group: 'Chiến đấu', path: 'assets/minecraft/sounds/entity/player/attack/knockback1.ogg', eventId: 'entity.player.attack.knockback', recommendMono: true },
  { label: 'Đánh yếu (Weak Attack)', group: 'Chiến đấu', path: 'assets/minecraft/sounds/entity/player/attack/weak1.ogg', eventId: 'entity.player.attack.weak', recommendMono: true },
  { label: 'Bắn cung (Bow Shoot)', group: 'Chiến đấu', path: 'assets/minecraft/sounds/random/bow.ogg', eventId: 'entity.arrow.shoot', recommendMono: true },
  { label: 'Mũi tên trúng người (Bow Hit)', group: 'Chiến đấu', path: 'assets/minecraft/sounds/random/successful_hit.ogg', eventId: 'entity.arrow.hit_player', recommendMono: true },
  { label: 'Mũi tên cắm đất (Arrow Hit)', group: 'Chiến đấu', path: 'assets/minecraft/sounds/random/bowhit1.ogg', eventId: 'entity.arrow.hit', recommendMono: true },
  { label: 'Nỏ bắn (Crossbow Shoot)', group: 'Chiến đấu', path: 'assets/minecraft/sounds/item/crossbow/shoot1.ogg', eventId: 'item.crossbow.shoot', recommendMono: true },
  { label: 'Nạp nỏ xong (Crossbow Load)', group: 'Chiến đấu', path: 'assets/minecraft/sounds/item/crossbow/loading_end.ogg', eventId: 'item.crossbow.loading_end', recommendMono: true },
  { label: 'Đỡ khiên (Shield Block)', group: 'Chiến đấu', path: 'assets/minecraft/sounds/item/shield/block1.ogg', eventId: 'item.shield.block', recommendMono: true },
  { label: 'Vỡ khiên (Shield Break)', group: 'Chiến đấu', path: 'assets/minecraft/sounds/random/break.ogg', eventId: 'item.shield.break', recommendMono: true },
  { label: 'Kích hoạt Totem (Totem of Undying)', group: 'Chiến đấu', path: 'assets/minecraft/sounds/item/totem/use_totem.ogg', eventId: 'item.totem.use', recommendMono: false },
  { label: 'Ném đinh ba (Trident Throw)', group: 'Chiến đấu', path: 'assets/minecraft/sounds/item/trident/throw1.ogg', eventId: 'item.trident.throw', recommendMono: true },
  { label: 'Đinh ba sét đánh (Trident Thunder)', group: 'Chiến đấu', path: 'assets/minecraft/sounds/item/trident/thunder1.ogg', eventId: 'item.trident.thunder', recommendMono: false },
  { label: 'Chùy Mace đập đất (Mace Smash)', group: 'Chiến đấu', path: 'assets/minecraft/sounds/item/mace/smash_ground1.ogg', eventId: 'item.mace.smash_ground', recommendMono: true },
  { label: 'Ném Ender Pearl / Tuyết (Throw)', group: 'Chiến đấu', path: 'assets/minecraft/sounds/random/bow.ogg', eventId: 'entity.ender_pearl.throw', recommendMono: true },

  // ======================== GAMEPLAY & VẬT PHẨM ========================
  { label: 'Nhặt kinh nghiệm (XP Orb)', group: 'Gameplay', path: 'assets/minecraft/sounds/random/orb.ogg', eventId: 'entity.experience_orb.pickup', recommendMono: true },
  { label: 'Lên cấp (Level Up)', group: 'Gameplay', path: 'assets/minecraft/sounds/random/levelup.ogg', eventId: 'entity.player.levelup', recommendMono: false },
  { label: 'Nhặt vật phẩm (Item Pickup)', group: 'Gameplay', path: 'assets/minecraft/sounds/random/pop.ogg', eventId: 'entity.item.pickup', recommendMono: true },
  { label: 'Ăn thức ăn (Eat 1)', group: 'Gameplay', path: 'assets/minecraft/sounds/random/eat1.ogg', eventId: 'entity.generic.eat', recommendMono: true },
  { label: 'Uống thuốc / Nước (Drink)', group: 'Gameplay', path: 'assets/minecraft/sounds/random/drink.ogg', eventId: 'entity.generic.drink', recommendMono: true },
  { label: 'Ợ hơi sau khi ăn (Burp)', group: 'Gameplay', path: 'assets/minecraft/sounds/random/burp.ogg', eventId: 'entity.player.burp', recommendMono: true },
  { label: 'Mặc giáp Kim cương (Armor Equip)', group: 'Gameplay', path: 'assets/minecraft/sounds/item/armor/equip_diamond1.ogg', eventId: 'item.armor.equip_diamond', recommendMono: true },
  { label: 'Mặc giáp Netherite', group: 'Gameplay', path: 'assets/minecraft/sounds/item/armor/equip_netherite1.ogg', eventId: 'item.armor.equip_netherite', recommendMono: true },
  { label: 'Bay Elytra (Elytra Flying)', group: 'Gameplay', path: 'assets/minecraft/sounds/item/elytra/elytra_loop.ogg', eventId: 'item.elytra.flying', recommendMono: false },
  { label: 'Bắn pháo hoa (Firework Launch)', group: 'Gameplay', path: 'assets/minecraft/sounds/fireworks/launch1.ogg', eventId: 'entity.firework_rocket.launch', recommendMono: true },
  { label: 'Nổ pháo hoa (Firework Blast)', group: 'Gameplay', path: 'assets/minecraft/sounds/fireworks/blast1.ogg', eventId: 'entity.firework_rocket.blast', recommendMono: true },
  { label: 'Nổ TNT / Creeper (Explode 1)', group: 'Gameplay', path: 'assets/minecraft/sounds/random/explode1.ogg', eventId: 'entity.generic.explode', recommendMono: true },
  { label: 'Bật bật lửa (Flint & Steel)', group: 'Gameplay', path: 'assets/minecraft/sounds/fire/ignite.ogg', eventId: 'item.flintandsteel.use', recommendMono: true },
  { label: 'Múc nước / Xô (Bucket Fill)', group: 'Gameplay', path: 'assets/minecraft/sounds/item/bucket/fill1.ogg', eventId: 'item.bucket.fill', recommendMono: true },
  { label: 'Đổ nước / Xô (Bucket Empty)', group: 'Gameplay', path: 'assets/minecraft/sounds/item/bucket/empty1.ogg', eventId: 'item.bucket.empty', recommendMono: true },
  { label: 'Ngã từ trên cao (Fall Big)', group: 'Gameplay', path: 'assets/minecraft/sounds/damage/fallbig.ogg', eventId: 'entity.player.big_fall', recommendMono: true },

  // ======================== BLOCK, CỬA & REDSTONE ========================
  { label: 'Mở rương (Chest Open)', group: 'Block & Cửa', path: 'assets/minecraft/sounds/random/chestopen.ogg', eventId: 'block.chest.open', recommendMono: true },
  { label: 'Đóng rương (Chest Close)', group: 'Block & Cửa', path: 'assets/minecraft/sounds/random/chestclosed.ogg', eventId: 'block.chest.close', recommendMono: true },
  { label: 'Mở Ender Chest', group: 'Block & Cửa', path: 'assets/minecraft/sounds/random/enderchestopen.ogg', eventId: 'block.ender_chest.open', recommendMono: true },
  { label: 'Mở cửa gỗ (Door Open)', group: 'Block & Cửa', path: 'assets/minecraft/sounds/random/door_open.ogg', eventId: 'block.wooden_door.open', recommendMono: true },
  { label: 'Đóng cửa gỗ (Door Close)', group: 'Block & Cửa', path: 'assets/minecraft/sounds/random/door_close.ogg', eventId: 'block.wooden_door.close', recommendMono: true },
  { label: 'Rèn đe (Anvil Use)', group: 'Block & Cửa', path: 'assets/minecraft/sounds/random/anvil_use.ogg', eventId: 'block.anvil.use', recommendMono: true },
  { label: 'Đe rơi (Anvil Land)', group: 'Block & Cửa', path: 'assets/minecraft/sounds/random/anvil_land.ogg', eventId: 'block.anvil.land', recommendMono: true },
  { label: 'Đập kính vỡ (Glass Break)', group: 'Block & Cửa', path: 'assets/minecraft/sounds/random/glass1.ogg', eventId: 'block.glass.break', recommendMono: true },
  { label: 'Đập khối đá (Stone Break)', group: 'Block & Cửa', path: 'assets/minecraft/sounds/dig/stone1.ogg', eventId: 'block.stone.break', recommendMono: true },
  { label: 'Đập khối gỗ (Wood Break)', group: 'Block & Cửa', path: 'assets/minecraft/sounds/dig/wood1.ogg', eventId: 'block.wood.break', recommendMono: true },
  { label: 'Đập khối cỏ/đất (Grass Break)', group: 'Block & Cửa', path: 'assets/minecraft/sounds/dig/grass1.ogg', eventId: 'block.grass.break', recommendMono: true },
  { label: 'Đập khối cát (Sand Break)', group: 'Block & Cửa', path: 'assets/minecraft/sounds/dig/sand1.ogg', eventId: 'block.sand.break', recommendMono: true },
  { label: 'Bước chân trên cỏ (Grass Step)', group: 'Block & Cửa', path: 'assets/minecraft/sounds/step/grass1.ogg', eventId: 'block.grass.step', recommendMono: true },
  { label: 'Bước chân trên đá (Stone Step)', group: 'Block & Cửa', path: 'assets/minecraft/sounds/step/stone1.ogg', eventId: 'block.stone.step', recommendMono: true },
  { label: 'Piston đẩy (Piston Out)', group: 'Block & Cửa', path: 'assets/minecraft/sounds/tile/piston/out.ogg', eventId: 'block.piston.extend', recommendMono: true },
  { label: 'Piston rút (Piston In)', group: 'Block & Cửa', path: 'assets/minecraft/sounds/tile/piston/in.ogg', eventId: 'block.piston.contract', recommendMono: true },
  { label: 'Note Block Piano (Harp)', group: 'Block & Cửa', path: 'assets/minecraft/sounds/note/harp.ogg', eventId: 'block.note_block.harp', recommendMono: true },
  { label: 'Chuông làng (Bell Ring)', group: 'Block & Cửa', path: 'assets/minecraft/sounds/block/bell/bell_use01.ogg', eventId: 'block.bell.use', recommendMono: true },
  { label: 'Cổng Nether (Portal Travel)', group: 'Block & Cửa', path: 'assets/minecraft/sounds/portal/travel.ogg', eventId: 'block.portal.travel', recommendMono: false },

  // ======================== MOB & THÚ CƯNG ========================
  { label: 'Mèo kêu (Cat Meow)', group: 'Mob', path: 'assets/minecraft/sounds/mob/cat/meow1.ogg', eventId: 'entity.cat.ambient', recommendMono: true },
  { label: 'Sói sủa (Wolf Bark)', group: 'Mob', path: 'assets/minecraft/sounds/mob/wolf/bark1.ogg', eventId: 'entity.wolf.ambient', recommendMono: true },
  { label: 'Dân làng Đồng ý (Villager Yes)', group: 'Mob', path: 'assets/minecraft/sounds/mob/villager/yes1.ogg', eventId: 'entity.villager.yes', recommendMono: true },
  { label: 'Dân làng Không (Villager No)', group: 'Mob', path: 'assets/minecraft/sounds/mob/villager/no1.ogg', eventId: 'entity.villager.no', recommendMono: true },
  { label: 'Creeper xì khói (Creeper Fuse)', group: 'Mob', path: 'assets/minecraft/sounds/random/fuse.ogg', eventId: 'entity.creeper.primed', recommendMono: true },
  { label: 'Zombie kêu (Zombie Say)', group: 'Mob', path: 'assets/minecraft/sounds/mob/zombie/say1.ogg', eventId: 'entity.zombie.ambient', recommendMono: true },
  { label: 'Skeleton kêu (Skeleton Say)', group: 'Mob', path: 'assets/minecraft/sounds/mob/skeleton/say1.ogg', eventId: 'entity.skeleton.ambient', recommendMono: true },
  { label: 'Enderman dịch chuyển (Teleport)', group: 'Mob', path: 'assets/minecraft/sounds/mob/endermen/portal.ogg', eventId: 'entity.enderman.teleport', recommendMono: true },
  { label: 'Enderman nổi giận (Scream)', group: 'Mob', path: 'assets/minecraft/sounds/mob/endermen/scream1.ogg', eventId: 'entity.enderman.scream', recommendMono: true },
  { label: 'Ghast khóc (Ghast Moan)', group: 'Mob', path: 'assets/minecraft/sounds/mob/ghast/moan1.ogg', eventId: 'entity.ghast.ambient', recommendMono: true },
  { label: 'Ender Dragon gầm (Dragon Growl)', group: 'Mob', path: 'assets/minecraft/sounds/mob/enderdragon/growl1.ogg', eventId: 'entity.ender_dragon.growl', recommendMono: false },
  { label: 'Warden gầm (Warden Roar)', group: 'Mob', path: 'assets/minecraft/sounds/mob/warden/roar1.ogg', eventId: 'entity.warden.roar', recommendMono: true },
  { label: 'Tù và Raid (Raid Horn)', group: 'Mob', path: 'assets/minecraft/sounds/event/raid/raidhorn_01.ogg', eventId: 'event.raid.horn', recommendMono: false },

  // ======================== NHẠC NỀN & ĐĨA NHẠC ========================
  { label: 'Nhạc nền Menu (Menu 1)', group: 'Nhạc & Đĩa', path: 'assets/minecraft/sounds/music/menu/menu1.ogg', eventId: 'music.menu', recommendMono: false },
  { label: 'Nhạc nền Overworld (Calm 1)', group: 'Nhạc & Đĩa', path: 'assets/minecraft/sounds/music/game/calm1.ogg', eventId: 'music.game', recommendMono: false },
  { label: 'Nhạc nền Creative (Creative 1)', group: 'Nhạc & Đĩa', path: 'assets/minecraft/sounds/music/game/creative/creative1.ogg', eventId: 'music.creative', recommendMono: false },
  { label: 'Nhạc nền Nether (Nether 1)', group: 'Nhạc & Đĩa', path: 'assets/minecraft/sounds/music/game/nether/nether1.ogg', eventId: 'music.nether.nether_wastes', recommendMono: false },
  { label: 'Nhạc nền The End (End)', group: 'Nhạc & Đĩa', path: 'assets/minecraft/sounds/music/game/end/end.ogg', eventId: 'music.end', recommendMono: false },
  { label: 'Đĩa nhạc 13', group: 'Nhạc & Đĩa', path: 'assets/minecraft/sounds/records/13.ogg', eventId: 'music_disc.13', recommendMono: false },
  { label: 'Đĩa nhạc Cat', group: 'Nhạc & Đĩa', path: 'assets/minecraft/sounds/records/cat.ogg', eventId: 'music_disc.cat', recommendMono: false },
  { label: 'Đĩa nhạc Blocks', group: 'Nhạc & Đĩa', path: 'assets/minecraft/sounds/records/blocks.ogg', eventId: 'music_disc.blocks', recommendMono: false },
  { label: 'Đĩa nhạc Chirp', group: 'Nhạc & Đĩa', path: 'assets/minecraft/sounds/records/chirp.ogg', eventId: 'music_disc.chirp', recommendMono: false },
  { label: 'Đĩa nhạc Far', group: 'Nhạc & Đĩa', path: 'assets/minecraft/sounds/records/far.ogg', eventId: 'music_disc.far', recommendMono: false },
  { label: 'Đĩa nhạc Mall', group: 'Nhạc & Đĩa', path: 'assets/minecraft/sounds/records/mall.ogg', eventId: 'music_disc.mall', recommendMono: false },
  { label: 'Đĩa nhạc Mellohi', group: 'Nhạc & Đĩa', path: 'assets/minecraft/sounds/records/mellohi.ogg', eventId: 'music_disc.mellohi', recommendMono: false },
  { label: 'Đĩa nhạc Stal', group: 'Nhạc & Đĩa', path: 'assets/minecraft/sounds/records/stal.ogg', eventId: 'music_disc.stal', recommendMono: false },
  { label: 'Đĩa nhạc Strad', group: 'Nhạc & Đĩa', path: 'assets/minecraft/sounds/records/strad.ogg', eventId: 'music_disc.strad', recommendMono: false },
  { label: 'Đĩa nhạc Ward', group: 'Nhạc & Đĩa', path: 'assets/minecraft/sounds/records/ward.ogg', eventId: 'music_disc.ward', recommendMono: false },
  { label: 'Đĩa nhạc Wait', group: 'Nhạc & Đĩa', path: 'assets/minecraft/sounds/records/wait.ogg', eventId: 'music_disc.wait', recommendMono: false },
  { label: 'Đĩa nhạc Pigstep', group: 'Nhạc & Đĩa', path: 'assets/minecraft/sounds/records/pigstep.ogg', eventId: 'music_disc.pigstep', recommendMono: false },
  { label: 'Đĩa nhạc Otherside', group: 'Nhạc & Đĩa', path: 'assets/minecraft/sounds/records/otherside.ogg', eventId: 'music_disc.otherside', recommendMono: false },
  { label: 'Đĩa nhạc Relic', group: 'Nhạc & Đĩa', path: 'assets/minecraft/sounds/records/relic.ogg', eventId: 'music_disc.relic', recommendMono: false },
  { label: 'Đĩa nhạc Creator', group: 'Nhạc & Đĩa', path: 'assets/minecraft/sounds/records/creator.ogg', eventId: 'music_disc.creator', recommendMono: false },
  { label: 'Đĩa nhạc Precipice', group: 'Nhạc & Đĩa', path: 'assets/minecraft/sounds/records/precipice.ogg', eventId: 'music_disc.precipice', recommendMono: false },

  // ======================== MÔI TRƯỜNG & TÙY CHỈNH ========================
  { label: 'Tiếng sấm sét (Thunder 1)', group: 'Môi trường', path: 'assets/minecraft/sounds/ambient/weather/thunder1.ogg', eventId: 'entity.lightning_bolt.thunder', recommendMono: false },
  { label: 'Tiếng mưa (Rain 1)', group: 'Môi trường', path: 'assets/minecraft/sounds/ambient/weather/rain1.ogg', eventId: 'weather.rain', recommendMono: false },
  { label: 'Nhảy xuống nước (Splash)', group: 'Môi trường', path: 'assets/minecraft/sounds/random/splash.ogg', eventId: 'entity.generic.splash', recommendMono: true },
  { label: 'Âm thanh tùy chỉnh (custom/my_sound)', group: 'Tùy chỉnh', path: 'assets/minecraft/sounds/custom/my_sound.ogg', eventId: 'custom.my_sound', recommendMono: true },
];
