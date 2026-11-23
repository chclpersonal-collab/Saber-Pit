/** Arena rewards for fictional saber contacts, in points of the same
 * 0–100 stamina pool used to attack and guard. No stamina is stolen. */
export const ARCADE_BODY_STAMINA=Object.freeze({
  head:6,
  torso:4,
  leftArm:3,
  rightArm:3,
  leftLeg:5,
  rightLeg:5,
});
export function arcadeBodyStaminaReward(region){
  return typeof region==='string'&&Object.hasOwn(ARCADE_BODY_STAMINA,region)?ARCADE_BODY_STAMINA[region]:0;
}
