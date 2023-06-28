import get_phase1_stakers
import get_all_stakers

if __name__ == '__main__':
    ordered = get_phase1_stakers.get_phase1_stakers()

    stakers = get_all_stakers.get_all_stakers()
    all_stakers = {x[0] : float(x[1])/1e27 for x in stakers}

    for x in ordered:
        if x[0] not in all_stakers:
            all_stakers[x[0]] = x[1]
        else:
          all_stakers[x[0]] += x[1]

    all_stakers = sorted(all_stakers.items(), key=lambda x: x[1], reverse=True)
    for x in all_stakers:
        print(f"{x[0]}: {x[1]:.4f}")