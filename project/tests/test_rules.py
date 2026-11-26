from backend.domain.catalog import TYPES, compatible_types, is_compatible


def test_o_negative_is_universal_red_cell_donor():
    assert all(is_compatible("RBC", r, "O-") for r in TYPES)


def test_ab_positive_receives_all_red_cells():
    assert set(compatible_types("RBC", "AB+")) == set(TYPES)


def test_rh_negative_never_gets_rh_positive():
    for r in [t for t in TYPES if t.endswith("-")]:
        for comp in ("RBC", "PLT"):
            assert all(d.endswith("-") for d in compatible_types(comp, r))


def test_platelets_are_abo_identical():
    for r in TYPES:
        assert all(d.rstrip("+-") == r.rstrip("+-") for d in compatible_types("PLT", r))


def test_a_cannot_receive_b():
    assert not is_compatible("RBC", "A+", "B+")
