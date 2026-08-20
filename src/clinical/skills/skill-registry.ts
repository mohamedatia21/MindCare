import { MentalHealthSkill, SkillId } from './skill-types.js';

export class SkillRegistry {
  private skills: Map<SkillId, MentalHealthSkill> = new Map();

  public register(skill: MentalHealthSkill): void {
    if (this.skills.has(skill.id)) {
      throw new Error(`Skill ${skill.id} is already registered.`);
    }
    this.skills.set(skill.id, skill);
  }

  public get(id: SkillId): MentalHealthSkill | undefined {
    return this.skills.get(id);
  }

  public getAll(): MentalHealthSkill[] {
    return Array.from(this.skills.values());
  }
}
